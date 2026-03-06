package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type UserHandler struct {
	queries *store.Queries
}

func NewUserHandler(q *store.Queries) *UserHandler {
	return &UserHandler{queries: q}
}

func (h *UserHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	user, err := h.queries.UpsertUser(r.Context(), store.UpsertUserParams{
		ClerkID: clerkID,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to get user"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

type updateSettingsRequest struct {
	DefaultLatitude    *float64 `json:"default_latitude"`
	DefaultLongitude   *float64 `json:"default_longitude"`
	DefaultRadiusMiles *int32   `json:"default_radius_miles"`
}

func (h *UserHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req updateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	var lat pgtype.Float8
	if req.DefaultLatitude != nil {
		lat = pgtype.Float8{Float64: *req.DefaultLatitude, Valid: true}
	}
	var lng pgtype.Float8
	if req.DefaultLongitude != nil {
		lng = pgtype.Float8{Float64: *req.DefaultLongitude, Valid: true}
	}
	var radius pgtype.Int4
	if req.DefaultRadiusMiles != nil {
		radius = pgtype.Int4{Int32: *req.DefaultRadiusMiles, Valid: true}
	}

	updated, err := h.queries.UpdateUserSettings(r.Context(), store.UpdateUserSettingsParams{
		ID:                 user.ID,
		DefaultLatitude:    lat,
		DefaultLongitude:   lng,
		DefaultRadiusMiles: radius,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to update settings"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (h *UserHandler) ListSaved(w http.ResponseWriter, r *http.Request) {
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

	events, err := h.queries.ListSavedEvents(r.Context(), user.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to list saved events"}`, http.StatusInternalServerError)
		return
	}

	if events == nil {
		events = []store.Event{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

func (h *UserHandler) SaveEvent(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	eventIDStr := chi.URLParam(r, "eventId")
	eventID, err := uuid.Parse(eventIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid event id"}`, http.StatusBadRequest)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	saved, err := h.queries.SaveEvent(r.Context(), store.SaveEventParams{
		UserID:  user.ID,
		EventID: pgtype.UUID{Bytes: eventID, Valid: true},
	})
	if err != nil {
		http.Error(w, `{"error":"failed to save event"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(saved)
}

func (h *UserHandler) UnsaveEvent(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	eventIDStr := chi.URLParam(r, "eventId")
	eventID, err := uuid.Parse(eventIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid event id"}`, http.StatusBadRequest)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	if err := h.queries.UnsaveEvent(r.Context(), store.UnsaveEventParams{
		UserID:  user.ID,
		EventID: pgtype.UUID{Bytes: eventID, Valid: true},
	}); err != nil {
		http.Error(w, `{"error":"failed to unsave event"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
