package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/notifier"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type VenueHandler struct {
	queries  *store.Queries
	notifier *notifier.VenueNotifier
}

func NewVenueHandler(q *store.Queries, vn *notifier.VenueNotifier) *VenueHandler {
	return &VenueHandler{queries: q, notifier: vn}
}

type venueResponse struct {
	ID                     string   `json:"ID"`
	VenueName              string   `json:"VenueName"`
	Address                string   `json:"Address"`
	City                   string   `json:"City"`
	State                  string   `json:"State"`
	Zip                    string   `json:"Zip"`
	Latitude               float64  `json:"Latitude"`
	Longitude              float64  `json:"Longitude"`
	Hours                  string   `json:"Hours,omitempty"`
	Description            string   `json:"Description,omitempty"`
	Genres                 []string `json:"Genres"`
	BookingEmail           string   `json:"BookingEmail,omitempty"`
	AcceptsBookingRequests bool     `json:"AcceptsBookingRequests"`
	IsClaimed              bool     `json:"IsClaimed"`
}

func venueToResponse(v store.Venue) venueResponse {
	idBytes := v.ID.Bytes
	id := uuid.UUID(idBytes).String()
	genres := v.Genres
	if genres == nil {
		genres = []string{}
	}
	return venueResponse{
		ID:                     id,
		VenueName:              v.Name,
		Address:                v.Address.String,
		City:                   v.City.String,
		State:                  v.State.String,
		Zip:                    v.Zip.String,
		Latitude:               v.Latitude,
		Longitude:              v.Longitude,
		Hours:                  v.Hours.String,
		Description:            v.Description.String,
		Genres:                 genres,
		BookingEmail:           v.BookingEmail.String,
		AcceptsBookingRequests: v.AcceptsBookingRequests,
		IsClaimed:              v.IsClaimed,
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

// MusicList returns "music venues" near a location: venues with a claimed
// profile or genre tags, plus venues hosting upcoming Music-category events.
func (h *VenueHandler) MusicList(w http.ResponseWriter, r *http.Request) {
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

	radiusMiles := 50.0
	if v := r.URL.Query().Get("radius"); v != "" {
		radiusMiles, err = strconv.ParseFloat(v, 64)
		if err != nil {
			http.Error(w, `{"error":"invalid radius"}`, http.StatusBadRequest)
			return
		}
	}

	rows, err := h.queries.ListMusicVenuesByLocation(r.Context(), store.ListMusicVenuesByLocationParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMiles * 1609.34,
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
	Name                   string   `json:"name"`
	Address                *string  `json:"address"`
	City                   *string  `json:"city"`
	State                  *string  `json:"state"`
	Zip                    *string  `json:"zip"`
	Latitude               float64  `json:"latitude"`
	Longitude              float64  `json:"longitude"`
	Hours                  *string  `json:"hours"`
	Description            *string  `json:"description"`
	Genres                 []string `json:"genres"`
	BookingEmail           *string  `json:"booking_email"`
	AcceptsBookingRequests *bool    `json:"accepts_booking_requests"`
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
		Name:                   req.Name,
		Address:                textFromPtr(req.Address),
		City:                   textFromPtr(req.City),
		State:                  textFromPtr(req.State),
		Zip:                    textFromPtr(req.Zip),
		Latitude:               req.Latitude,
		Longitude:              req.Longitude,
		Hours:                  textFromPtr(req.Hours),
		Description:            textFromPtr(req.Description),
		Genres:                 req.Genres,
		BookingEmail:           textFromPtr(req.BookingEmail),
		AcceptsBookingRequests: boolFromPtr(req.AcceptsBookingRequests),
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
		ID:                     pgtype.UUID{Bytes: id, Valid: true},
		Name:                   req.Name,
		Address:                textFromPtr(req.Address),
		City:                   textFromPtr(req.City),
		State:                  textFromPtr(req.State),
		Zip:                    textFromPtr(req.Zip),
		Latitude:               req.Latitude,
		Longitude:              req.Longitude,
		Hours:                  textFromPtr(req.Hours),
		Description:            textFromPtr(req.Description),
		Genres:                 req.Genres,
		BookingEmail:           textFromPtr(req.BookingEmail),
		AcceptsBookingRequests: boolFromPtr(req.AcceptsBookingRequests),
	})
	if err != nil {
		http.Error(w, `{"error":"failed to update venue"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(venueToResponse(venue))
}

type bookingRequestBody struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Message string `json:"message"`
}

// BookingRequest emails a venue's booking contact with an artist's inquiry.
// Any signed-in user may send one, provided the venue opted in and has a
// booking email. No request record is stored — it's a direct contact form.
func (h *VenueHandler) BookingRequest(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

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

	if !venue.AcceptsBookingRequests || venue.BookingEmail.String == "" {
		http.Error(w, `{"error":"this venue is not accepting booking requests"}`, http.StatusBadRequest)
		return
	}

	var req bookingRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if req.Name == "" || req.Email == "" || req.Message == "" {
		http.Error(w, `{"error":"name, email, and message are required"}`, http.StatusBadRequest)
		return
	}

	if !h.notifier.Enabled() {
		http.Error(w, `{"error":"booking requests are temporarily unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	if err := h.notifier.SendBookingRequest(venue.BookingEmail.String, venue.Name, req.Name, req.Email, req.Message); err != nil {
		http.Error(w, `{"error":"failed to send booking request"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
