package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/planner"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

// maxSharedPlanBytes caps the request body for a shared snapshot.
const maxSharedPlanBytes = 128 * 1024

type PlannerHandler struct {
	queries *store.Queries
	gen     *planner.Generator
}

func NewPlannerHandler(q *store.Queries, gen *planner.Generator) *PlannerHandler {
	return &PlannerHandler{queries: q, gen: gen}
}

// GetMyPlan returns the authenticated user's most recent persisted itinerary.
// Plans are generated weekly alongside the digest (and overwritten by an
// on-demand recalculation); if none exists yet the response is
// {"status":"none"} so the frontend can prompt the user.
func (h *PlannerHandler) GetMyPlan(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	row, err := h.queries.GetLatestDailyPlan(r.Context(), user.ID)
	if err != nil {
		writeJSON(w, map[string]string{"status": "none"})
		return
	}

	writeJSON(w, struct {
		Status      string          `json:"status"`
		WeekOf      string          `json:"week_of"`
		GeneratedAt time.Time       `json:"generated_at"`
		Plan        json.RawMessage `json:"plan"`
	}{
		Status:      "ready",
		WeekOf:      row.WeekOf.Time.Format("2006-01-02"),
		GeneratedAt: row.GeneratedAt.Time,
		Plan:        json.RawMessage(row.Plan),
	})
}

// Compute builds an itinerary on demand. Open to everyone (optional auth):
//   - Anonymous: requires lat/lng query params and optional categories; returns
//     a transient, proximity/category-ranked plan (no personalization, not stored).
//   - Authenticated: personalizes ranking with the user's preference vector,
//     falls back to their default location/categories when omitted, and
//     overwrites their stored weekly plan with the result.
func (h *PlannerHandler) Compute(w http.ResponseWriter, r *http.Request) {
	// Resolve the caller (if signed in).
	var user store.User
	var userID pgtype.UUID
	authed := false
	if clerkID := middleware.GetClerkUserID(r.Context()); clerkID != "" {
		if u, err := h.queries.GetUserByClerkID(r.Context(), clerkID); err == nil {
			user = u
			userID = u.ID
			authed = true
		}
	}

	// parseLocation (from recommendations.go) uses lat/lng query params, falling
	// back to the user's default location. For anonymous callers `user` is the
	// zero value, so only the query params are considered.
	lat, lng, ok := parseLocation(r, user)
	if !ok {
		http.Error(w, `{"error":"location required (lat & lng query params or a saved default location)"}`, http.StatusBadRequest)
		return
	}

	radiusMiles := 25.0
	if v := r.URL.Query().Get("radius"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 && f <= 100 {
			radiusMiles = f
		}
	}

	categories := splitCategories(r.URL.Query().Get("categories"))
	if len(categories) == 0 && authed {
		categories = h.gen.ResolveCategories(r.Context(), userID, nil)
	}

	var plan planner.WeeklyPlan
	var err error
	if authed {
		plan, err = h.gen.ComputeAndStore(r.Context(), userID, lat, lng, radiusMiles, categories)
	} else {
		plan, err = h.gen.Compute(r.Context(), pgtype.UUID{}, lat, lng, radiusMiles, categories)
	}
	if err != nil {
		http.Error(w, `{"error":"failed to build plan"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, struct {
		Status string             `json:"status"`
		Plan   planner.WeeklyPlan `json:"plan"`
	}{Status: "ready", Plan: plan})
}

// Share stores a snapshot of an itinerary and returns a token for a public
// link. Open to everyone (optional auth records the author when signed in). The
// posted JSON is decoded into our plan shape and re-marshaled, so only known
// fields are persisted.
func (h *PlannerHandler) Share(w http.ResponseWriter, r *http.Request) {
	var createdBy pgtype.UUID
	if clerkID := middleware.GetClerkUserID(r.Context()); clerkID != "" {
		if u, err := h.queries.GetUserByClerkID(r.Context(), clerkID); err == nil {
			createdBy = u.ID
		}
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxSharedPlanBytes)
	var plan planner.WeeklyPlan
	if err := json.NewDecoder(r.Body).Decode(&plan); err != nil {
		http.Error(w, `{"error":"invalid plan"}`, http.StatusBadRequest)
		return
	}
	if len(plan.Days) == 0 {
		http.Error(w, `{"error":"plan has no days"}`, http.StatusBadRequest)
		return
	}

	planJSON, err := json.Marshal(plan)
	if err != nil {
		http.Error(w, `{"error":"failed to encode plan"}`, http.StatusInternalServerError)
		return
	}

	token, err := h.queries.CreateSharedPlan(r.Context(), store.CreateSharedPlanParams{
		Plan:      planJSON,
		CreatedBy: createdBy,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to create share link"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"token": uuid.UUID(token.Bytes).String()})
}

// GetShared returns a previously shared itinerary snapshot. Public.
func (h *PlannerHandler) GetShared(w http.ResponseWriter, r *http.Request) {
	tok, err := uuid.Parse(chi.URLParam(r, "token"))
	if err != nil {
		http.Error(w, `{"error":"invalid token"}`, http.StatusBadRequest)
		return
	}

	row, err := h.queries.GetSharedPlan(r.Context(), pgtype.UUID{Bytes: tok, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"shared plan not found"}`, http.StatusNotFound)
		return
	}

	writeJSON(w, struct {
		Status    string          `json:"status"`
		CreatedAt time.Time       `json:"created_at"`
		Plan      json.RawMessage `json:"plan"`
	}{
		Status:    "ready",
		CreatedAt: row.CreatedAt.Time,
		Plan:      json.RawMessage(row.Plan),
	})
}

// splitCategories parses a comma-separated category list, trimming blanks.
func splitCategories(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if c := strings.TrimSpace(p); c != "" {
			out = append(out, c)
		}
	}
	return out
}
