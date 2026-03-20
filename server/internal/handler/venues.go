package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type VenueHandler struct {
	queries *store.Queries
}

func NewVenueHandler(q *store.Queries) *VenueHandler {
	return &VenueHandler{queries: q}
}

type venueResponse struct {
	ID          string  `json:"ID"`
	VenueName   string  `json:"VenueName"`
	Address     string  `json:"Address"`
	City        string  `json:"City"`
	State       string  `json:"State"`
	Zip         string  `json:"Zip"`
	Latitude    float64 `json:"Latitude"`
	Longitude   float64 `json:"Longitude"`
	Hours       string  `json:"Hours,omitempty"`
	Description string  `json:"Description,omitempty"`
}

func venueToResponse(v store.Venue) venueResponse {
	idBytes := v.ID.Bytes
	id := uuid.UUID(idBytes).String()
	return venueResponse{
		ID:          id,
		VenueName:   v.Name,
		Address:     v.Address.String,
		City:        v.City.String,
		State:       v.State.String,
		Zip:         v.Zip.String,
		Latitude:    v.Latitude,
		Longitude:   v.Longitude,
		Hours:       v.Hours.String,
		Description: v.Description.String,
	}
}

func (h *VenueHandler) List(w http.ResponseWriter, r *http.Request) {
	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	if latStr == "" || lngStr == "" {
		http.Error(w, `{"error":"lat and lng are required"}`, http.StatusBadRequest)
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid lat"}`, http.StatusBadRequest)
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid lng"}`, http.StatusBadRequest)
		return
	}

	radiusMiles := 100.0
	if v := r.URL.Query().Get("radius"); v != "" {
		radiusMiles, err = strconv.ParseFloat(v, 64)
		if err != nil {
			http.Error(w, `{"error":"invalid radius"}`, http.StatusBadRequest)
			return
		}
	}
	radiusMeters := radiusMiles * 1609.34

	rows, err := h.queries.ListVenuesByLocation(r.Context(), store.ListVenuesByLocationParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMeters,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to query venues"}`, http.StatusInternalServerError)
		return
	}

	venues := make([]venueResponse, 0, len(rows))
	for _, row := range rows {
		venues = append(venues, venueToResponse(row))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Venues []venueResponse `json:"venues"`
	}{Venues: venues})
}

func (h *VenueHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid venue id"}`, http.StatusBadRequest)
		return
	}

	venue, err := h.queries.GetVenue(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"venue not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(venueToResponse(venue))
}

type createVenueRequest struct {
	Name        string  `json:"name"`
	Address     *string `json:"address"`
	City        *string `json:"city"`
	State       *string `json:"state"`
	Zip         *string `json:"zip"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	Hours       *string `json:"hours"`
	Description *string `json:"description"`
}

func (h *VenueHandler) Create(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	role, err := middleware.GetUserRole(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"failed to check role"}`, http.StatusInternalServerError)
		return
	}
	if !middleware.CanCreateEvent(role) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	var req createVenueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}

	venue, err := h.queries.CreateVenue(r.Context(), store.CreateVenueParams{
		Name:        req.Name,
		Address:     textFromPtr(req.Address),
		City:        textFromPtr(req.City),
		State:       textFromPtr(req.State),
		Zip:         textFromPtr(req.Zip),
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		Hours:       textFromPtr(req.Hours),
		Description: textFromPtr(req.Description),
	})
	if err != nil {
		http.Error(w, `{"error":"failed to create venue"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(venueToResponse(venue))
}

func (h *VenueHandler) Update(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	role, err := middleware.GetUserRole(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"failed to check role"}`, http.StatusInternalServerError)
		return
	}
	if !middleware.CanCreateEvent(role) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid venue id"}`, http.StatusBadRequest)
		return
	}

	var req createVenueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}

	venue, err := h.queries.UpdateVenue(r.Context(), store.UpdateVenueParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		Name:        req.Name,
		Address:     textFromPtr(req.Address),
		City:        textFromPtr(req.City),
		State:       textFromPtr(req.State),
		Zip:         textFromPtr(req.Zip),
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		Hours:       textFromPtr(req.Hours),
		Description: textFromPtr(req.Description),
	})
	if err != nil {
		http.Error(w, `{"error":"failed to update venue"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(venueToResponse(venue))
}
