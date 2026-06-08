package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/recommend"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type RecommendationHandler struct {
	queries *store.Queries
	recs    *recommend.Service
}

func NewRecommendationHandler(q *store.Queries, recs *recommend.Service) *RecommendationHandler {
	return &RecommendationHandler{queries: q, recs: recs}
}

type recsResponse struct {
	Status         string        `json:"status"` // "ready" | "learning"
	SignalCount    int32         `json:"signal_count"`
	SavesRemaining int32         `json:"saves_remaining"`
	Events         []store.Event `json:"events"`
}

// List returns personalized recommendations. When the user does not have
// enough signal yet, returns trending future events with status="learning"
// so the frontend can show a progress hint.
func (h *RecommendationHandler) List(w http.ResponseWriter, r *http.Request) {
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
	if err := h.queries.EnsureUserPreferences(r.Context(), user.ID); err != nil {
		http.Error(w, `{"error":"failed to init preferences"}`, http.StatusInternalServerError)
		return
	}

	lat, lng, ok := parseLocation(r, user)
	if !ok {
		http.Error(w, `{"error":"location required (lat/lng query param or default location)"}`, http.StatusBadRequest)
		return
	}

	radiusMiles := 25.0
	if v := r.URL.Query().Get("radius"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 {
			radiusMiles = f
		}
	}
	radiusMeters := radiusMiles * 1609.34

	limit := 20
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 50 {
			limit = n
		}
	}

	state, err := h.queries.GetUserPreferencesState(r.Context(), user.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to read preferences state"}`, http.StatusInternalServerError)
		return
	}

	resp := recsResponse{SignalCount: state.SignalCount, Events: []store.Event{}}

	// Cold-start: not enough signal — fall back to trending.
	if state.SignalCount < int32(recommend.MinSignalsForRecs) || h.recs == nil {
		resp.Status = "learning"
		resp.SavesRemaining = int32(recommend.MinSignalsForRecs) - state.SignalCount
		if resp.SavesRemaining < 0 {
			resp.SavesRemaining = 0
		}
		trending, err := h.queries.ListTrendingFutureEvents(r.Context(), store.ListTrendingFutureEventsParams{
			Lat:          lat,
			Lng:          lng,
			RadiusMeters: radiusMeters,
			EventLimit:   int32(limit),
		})
		if err != nil {
			http.Error(w, `{"error":"failed to load trending"}`, http.StatusInternalServerError)
			return
		}
		resp.Events = trendingToEvents(trending)
		writeJSON(w, resp)
		return
	}

	uid := uuid.UUID(user.ID.Bytes)

	// Lazy recompute: rebuild the user's preference vector inline if it's
	// missing or marked stale. The nightly cron remains a backstop for
	// inactive users; this just keeps the active path fresh.
	if !state.HasVector || state.NeedsRecompute {
		if _, err := h.recs.RecomputeUser(r.Context(), uid); err != nil {
			http.Error(w, `{"error":"failed to recompute preferences"}`, http.StatusInternalServerError)
			return
		}
	}

	// Ready: cosine search + MMR diversity re-rank.
	candidates, err := h.recs.FetchCandidates(r.Context(), uid, lat, lng, radiusMeters, limit*3)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch candidates"}`, http.StatusInternalServerError)
		return
	}
	if len(candidates) == 0 {
		resp.Status = "ready"
		writeJSON(w, resp)
		return
	}

	picked := recommend.MMR(candidates, limit, 0.7)
	ids := make([]pgtype.UUID, len(picked))
	for i, c := range picked {
		ids[i] = pgtype.UUID{Bytes: c.EventID, Valid: true}
	}
	events, err := h.queries.GetEventsByIDs(r.Context(), ids)
	if err != nil {
		http.Error(w, `{"error":"failed to load events"}`, http.StatusInternalServerError)
		return
	}
	// Preserve MMR order.
	byID := make(map[uuid.UUID]store.Event, len(events))
	for _, e := range events {
		byID[uuid.UUID(e.ID.Bytes)] = e
	}
	ordered := make([]store.Event, 0, len(picked))
	for _, c := range picked {
		if e, ok := byID[c.EventID]; ok {
			ordered = append(ordered, e)
		}
	}
	resp.Status = "ready"
	resp.Events = ordered
	writeJSON(w, resp)
}

// RecordView logs an event-card impression as a soft-signal and marks the
// user's preference vector stale. Best-effort: errors return 204 so a
// failed analytics ping never breaks the UI.
func (h *RecommendationHandler) RecordView(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	eventIDStr := chi.URLParam(r, "eventId")
	eventUUID, err := uuid.Parse(eventIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid event id"}`, http.StatusBadRequest)
		return
	}
	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err := h.queries.RecordEventView(r.Context(), store.RecordEventViewParams{
		UserID:  user.ID,
		EventID: pgtype.UUID{Bytes: eventUUID, Valid: true},
	}); err != nil {
		// A 23503 (foreign key violation) just means the event was deleted
		// between render and this impression ping — benign, so don't log it.
		var pgErr *pgconn.PgError
		if !(errors.As(err, &pgErr) && pgErr.Code == "23503") {
			log.Printf("record view: user=%s event=%s: %v", clerkID, eventUUID, err)
		}
	}
	if err := h.queries.EnsureUserPreferences(r.Context(), user.ID); err != nil {
		log.Printf("record view: ensure user preferences user=%s: %v", clerkID, err)
	}
	if err := h.queries.MarkUserPreferencesStale(r.Context(), user.ID); err != nil {
		log.Printf("record view: mark user preferences stale user=%s: %v", clerkID, err)
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseLocation(r *http.Request, user store.User) (lat, lng float64, ok bool) {
	if v := r.URL.Query().Get("lat"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			lat = f
		}
	}
	if v := r.URL.Query().Get("lng"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			lng = f
		}
	}
	if lat != 0 && lng != 0 {
		return lat, lng, true
	}
	if user.DefaultLatitude.Valid && user.DefaultLongitude.Valid {
		return user.DefaultLatitude.Float64, user.DefaultLongitude.Float64, true
	}
	return 0, 0, false
}

func trendingToEvents(rows []store.ListTrendingFutureEventsRow) []store.Event {
	out := make([]store.Event, len(rows))
	for i, r := range rows {
		out[i] = store.Event{
			ID:             r.ID,
			ExternalID:     r.ExternalID,
			Source:         r.Source,
			Title:          r.Title,
			Description:    r.Description,
			VenueName:      r.VenueName,
			Address:        r.Address,
			City:           r.City,
			State:          r.State,
			Zip:            r.Zip,
			Latitude:       r.Latitude,
			Longitude:      r.Longitude,
			StartTime:      r.StartTime,
			EndTime:        r.EndTime,
			ImageUrl:       r.ImageUrl,
			TicketUrl:      r.TicketUrl,
			PriceMin:       r.PriceMin,
			PriceMax:       r.PriceMax,
			SubmittedBy:    r.SubmittedBy,
			CreatedAt:      r.CreatedAt,
			UpdatedAt:      r.UpdatedAt,
			ManuallyEdited: r.ManuallyEdited,
			VenueID:        r.VenueID,
			Categories:     r.Categories,
			SeriesID:       r.SeriesID,
		}
	}
	return out
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
