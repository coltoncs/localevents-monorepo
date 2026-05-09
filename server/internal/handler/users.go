package handler

import (
	"encoding/json"
	"net/http"

	clerkuser "github.com/clerk/clerk-sdk-go/v2/user"
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

	// Fetch email from Clerk to keep it synced
	var email pgtype.Text
	if cu, err := clerkuser.Get(r.Context(), clerkID); err == nil {
		if cu.PrimaryEmailAddressID != nil {
			for _, ea := range cu.EmailAddresses {
				if ea.ID == *cu.PrimaryEmailAddressID {
					email = pgtype.Text{String: ea.EmailAddress, Valid: true}
					break
				}
			}
		}
	}

	user, err := h.queries.UpsertUser(r.Context(), store.UpsertUserParams{
		ClerkID: clerkID,
		Email:   email,
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

func (h *UserHandler) ListMyEvents(w http.ResponseWriter, r *http.Request) {
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

	events, err := h.queries.ListEventsBySubmitter(r.Context(), user.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to list events"}`, http.StatusInternalServerError)
		return
	}

	if events == nil {
		events = []store.Event{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
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

type placeCheckInItem struct {
	ID          string  `json:"id"`
	PlaceID     string  `json:"place_id"`
	PlaceName   string  `json:"place_name"`
	IsFood      bool    `json:"is_food"`
	IsDrink     bool    `json:"is_drink"`
	Cuisine     *string `json:"cuisine,omitempty"`
	BarType     *string `json:"bar_type,omitempty"`
	PlaceCity   *string `json:"place_city,omitempty"`
	PlaceImage  *string `json:"place_image_url,omitempty"`
	CheckinDate string  `json:"checkin_date"`
	CreatedAt   string  `json:"created_at"`
}

type placeCheckInStats struct {
	TotalCheckins    int64   `json:"total_checkins"`
	UniquePlaces     int64   `json:"unique_places"`
	UniqueFoods      int64   `json:"unique_foods"`
	UniqueBreweries  int64   `json:"unique_breweries"`
	UniqueBars       int64   `json:"unique_bars"`
	FirstCheckinDate *string `json:"first_checkin_date,omitempty"`
	LastCheckinDate  *string `json:"last_checkin_date,omitempty"`
}

type myPlaceCheckInsResponse struct {
	Stats    placeCheckInStats  `json:"stats"`
	CheckIns []placeCheckInItem `json:"checkins"`
}

func (h *UserHandler) ListMyPlaceCheckIns(w http.ResponseWriter, r *http.Request) {
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

	rows, err := h.queries.ListUserPlaceCheckIns(r.Context(), user.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to list check-ins"}`, http.StatusInternalServerError)
		return
	}

	stats, err := h.queries.GetUserPlaceCheckInStats(r.Context(), user.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to get check-in stats"}`, http.StatusInternalServerError)
		return
	}

	items := make([]placeCheckInItem, 0, len(rows))
	for _, row := range rows {
		item := placeCheckInItem{
			ID:          uuid.UUID(row.ID.Bytes).String(),
			PlaceID:     uuid.UUID(row.PlaceID.Bytes).String(),
			PlaceName:   row.PlaceName,
			IsFood:      row.PlaceIsFood,
			IsDrink:     row.PlaceIsDrink,
			CheckinDate: row.CheckinDate.Time.Format("2006-01-02"),
			CreatedAt:   row.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		}
		if row.PlaceCuisine.Valid {
			c := row.PlaceCuisine.String
			item.Cuisine = &c
		}
		if row.PlaceBarType.Valid {
			t := row.PlaceBarType.String
			item.BarType = &t
		}
		if row.PlaceCity.Valid {
			city := row.PlaceCity.String
			item.PlaceCity = &city
		}
		if row.PlaceImageUrl.Valid {
			img := row.PlaceImageUrl.String
			item.PlaceImage = &img
		}
		items = append(items, item)
	}

	resp := myPlaceCheckInsResponse{
		Stats: placeCheckInStats{
			TotalCheckins:   stats.TotalCheckins,
			UniquePlaces:    stats.UniquePlaces,
			UniqueFoods:     stats.UniqueFoods,
			UniqueBreweries: stats.UniqueBreweries,
			UniqueBars:      stats.UniqueBars,
		},
		CheckIns: items,
	}
	if stats.FirstCheckinDate.Valid {
		s := stats.FirstCheckinDate.Time.Format("2006-01-02")
		resp.Stats.FirstCheckinDate = &s
	}
	if stats.LastCheckinDate.Valid {
		s := stats.LastCheckinDate.Time.Format("2006-01-02")
		resp.Stats.LastCheckinDate = &s
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
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

	// Flag the user's preference vector for nightly recompute. Best-effort.
	_ = h.queries.EnsureUserPreferences(r.Context(), user.ID)
	_ = h.queries.MarkUserPreferencesStale(r.Context(), user.ID)

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

	_ = h.queries.EnsureUserPreferences(r.Context(), user.ID)
	_ = h.queries.MarkUserPreferencesStale(r.Context(), user.ID)

	w.WriteHeader(http.StatusNoContent)
}
