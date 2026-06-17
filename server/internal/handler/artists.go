package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/storage"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type ArtistHandler struct {
	queries *store.Queries
	r2      *storage.R2Client
}

func NewArtistHandler(q *store.Queries, r2 *storage.R2Client) *ArtistHandler {
	return &ArtistHandler{queries: q, r2: r2}
}

// List returns artists with an upcoming show near a location, optionally
// filtered by genre. Public.
func (h *ArtistHandler) List(w http.ResponseWriter, r *http.Request) {
	lat, lng, ok := parseLatLng(w, r)
	if !ok {
		return
	}

	radiusMiles := 50.0
	if v := r.URL.Query().Get("radius"); v != "" {
		if parsed, err := strconv.ParseFloat(v, 64); err == nil {
			radiusMiles = parsed
		}
	}

	var genre pgtype.Text
	if g := r.URL.Query().Get("genre"); g != "" {
		genre = pgtype.Text{String: g, Valid: true}
	}

	artists, err := h.queries.ListArtistsByLocation(r.Context(), store.ListArtistsByLocationParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMiles * 1609.34,
		Genre:        genre,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to query artists"}`, http.StatusInternalServerError)
		return
	}
	if artists == nil {
		artists = []store.Artist{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Artists []store.Artist `json:"artists"`
	}{Artists: artists})
}

func (h *ArtistHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid artist id"}`, http.StatusBadRequest)
		return
	}

	artist, err := h.queries.GetArtist(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"artist not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(artist)
}

// GetEvents returns an artist's upcoming shows. Public.
func (h *ArtistHandler) GetEvents(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid artist id"}`, http.StatusBadRequest)
		return
	}

	events, err := h.queries.ListUpcomingEventsForArtist(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"failed to query events"}`, http.StatusInternalServerError)
		return
	}
	if events == nil {
		events = []store.Event{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Events []store.Event `json:"events"`
	}{Events: events})
}

func (h *ArtistHandler) ListMine(w http.ResponseWriter, r *http.Request) {
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

	artists, err := h.queries.ListArtistsByOwner(r.Context(), user.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to query artists"}`, http.StatusInternalServerError)
		return
	}
	if artists == nil {
		artists = []store.Artist{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(artists)
}

type artistRequest struct {
	Name          string   `json:"name"`
	Bio           *string  `json:"bio"`
	Genres        []string `json:"genres"`
	ImageURL      *string  `json:"image_url"`
	WebsiteURL    *string  `json:"website_url"`
	SpotifyURL    *string  `json:"spotify_url"`
	InstagramURL  *string  `json:"instagram_url"`
	BandcampURL   *string  `json:"bandcamp_url"`
	YoutubeURL    *string  `json:"youtube_url"`
	HometownCity  *string  `json:"hometown_city"`
	HometownState *string  `json:"hometown_state"`
}

// Create makes a self-serve artist profile owned by the signed-in user, or
// claims an existing same-named stub. Any signed-in user may create one — no
// author role required.
func (h *ArtistHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req artistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}

	artist, err := h.queries.CreateArtist(r.Context(), store.CreateArtistParams{
		Name:          req.Name,
		Bio:           textFromPtr(req.Bio),
		Genres:        req.Genres,
		ImageUrl:      textFromPtr(req.ImageURL),
		WebsiteUrl:    textFromPtr(req.WebsiteURL),
		SpotifyUrl:    textFromPtr(req.SpotifyURL),
		InstagramUrl:  textFromPtr(req.InstagramURL),
		BandcampUrl:   textFromPtr(req.BandcampURL),
		YoutubeUrl:    textFromPtr(req.YoutubeURL),
		HometownCity:  textFromPtr(req.HometownCity),
		HometownState: textFromPtr(req.HometownState),
		OwnerUserID:   user.ID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// Name exists and is owned by someone else.
		http.Error(w, `{"error":"an artist with this name is already claimed"}`, http.StatusConflict)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"failed to create artist"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(artist)
}

func (h *ArtistHandler) Update(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid artist id"}`, http.StatusBadRequest)
		return
	}
	pgID := pgtype.UUID{Bytes: id, Valid: true}

	artist, err := h.queries.GetArtist(r.Context(), pgID)
	if err != nil {
		http.Error(w, `{"error":"artist not found"}`, http.StatusNotFound)
		return
	}

	if !h.canManageArtist(r, clerkID, artist) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	var req artistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.queries.UpdateArtist(r.Context(), store.UpdateArtistParams{
		ID:            pgID,
		Name:          req.Name,
		Bio:           textFromPtr(req.Bio),
		Genres:        req.Genres,
		ImageUrl:      textFromPtr(req.ImageURL),
		WebsiteUrl:    textFromPtr(req.WebsiteURL),
		SpotifyUrl:    textFromPtr(req.SpotifyURL),
		InstagramUrl:  textFromPtr(req.InstagramURL),
		BandcampUrl:   textFromPtr(req.BandcampURL),
		YoutubeUrl:    textFromPtr(req.YoutubeURL),
		HometownCity:  textFromPtr(req.HometownCity),
		HometownState: textFromPtr(req.HometownState),
	})
	if err != nil {
		http.Error(w, `{"error":"failed to update artist"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

// Delete removes an artist profile (owner or admin). event_artists links
// cascade away; the linked events themselves are not deleted.
func (h *ArtistHandler) Delete(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid artist id"}`, http.StatusBadRequest)
		return
	}
	pgID := pgtype.UUID{Bytes: id, Valid: true}

	artist, err := h.queries.GetArtist(r.Context(), pgID)
	if err != nil {
		http.Error(w, `{"error":"artist not found"}`, http.StatusNotFound)
		return
	}

	if !h.canManageArtist(r, clerkID, artist) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	if err := h.queries.DeleteArtist(r.Context(), pgID); err != nil {
		http.Error(w, `{"error":"failed to delete artist"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// CreateShow lets an artist's owner (or an admin) publish a Music event linked
// to that artist — a scoped path that does NOT require the author role.
func (h *ArtistHandler) CreateShow(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid artist id"}`, http.StatusBadRequest)
		return
	}
	pgID := pgtype.UUID{Bytes: id, Valid: true}

	artist, err := h.queries.GetArtist(r.Context(), pgID)
	if err != nil {
		http.Error(w, `{"error":"artist not found"}`, http.StatusNotFound)
		return
	}

	if !h.canManageArtist(r, clerkID, artist) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	var req createEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if req.Title == "" {
		http.Error(w, `{"error":"title is required"}`, http.StatusBadRequest)
		return
	}

	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		http.Error(w, `{"error":"invalid start_time, use RFC3339 format"}`, http.StatusBadRequest)
		return
	}
	var endTime pgtype.Timestamptz
	if req.EndTime != nil {
		t, err := time.Parse(time.RFC3339, *req.EndTime)
		if err != nil {
			http.Error(w, `{"error":"invalid end_time, use RFC3339 format"}`, http.StatusBadRequest)
			return
		}
		endTime = pgtype.Timestamptz{Time: t, Valid: true}
	}

	// Force the Music category so artist-published shows always surface in the
	// Concerts section.
	categories := ensureMusicCategory(req.Categories)

	venueID := uuidFromPtr(req.VenueID)
	if req.VenueID == nil && req.VenueName != nil && *req.VenueName != "" &&
		(req.Latitude != 0 || req.Longitude != 0) {
		venue, err := h.queries.UpsertVenue(r.Context(), store.UpsertVenueParams{
			Name:      *req.VenueName,
			Address:   textFromPtr(req.Address),
			City:      textFromPtr(req.City),
			State:     textFromPtr(req.State),
			Zip:       textFromPtr(req.Zip),
			Latitude:  req.Latitude,
			Longitude: req.Longitude,
		})
		if err == nil {
			venueID = venue.ID
		}
	}

	if h.r2 != nil && req.ImageURL != nil && *req.ImageURL != "" {
		if r2URL, err := h.r2.MirrorImage(r.Context(), *req.ImageURL); err == nil && r2URL != "" {
			req.ImageURL = &r2URL
		}
	}

	event, err := h.queries.CreateEvent(r.Context(), store.CreateEventParams{
		Source:      "user",
		Title:       req.Title,
		Description: textFromPtr(req.Description),
		VenueName:   textFromPtr(req.VenueName),
		Address:     textFromPtr(req.Address),
		City:        textFromPtr(req.City),
		State:       textFromPtr(req.State),
		Zip:         textFromPtr(req.Zip),
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		StartTime:   pgtype.Timestamptz{Time: startTime, Valid: true},
		EndTime:     endTime,
		Categories:  categories,
		Genre:       req.Genre,
		ImageUrl:    textFromPtr(req.ImageURL),
		TicketUrl:   textFromPtr(req.TicketURL),
		PriceMin:    numericFromFloat(req.PriceMin),
		PriceMax:    numericFromFloat(req.PriceMax),
		IsFree:      boolFromPtr(req.IsFree),
		SubmittedBy: user.ID,
		VenueID:     venueID,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to create event"}`, http.StatusInternalServerError)
		return
	}

	if err := h.queries.LinkEventArtist(r.Context(), store.LinkEventArtistParams{
		EventID:     event.ID,
		ArtistID:    pgID,
		Position:    0,
		IsHeadliner: true,
	}); err != nil {
		http.Error(w, `{"error":"event created but failed to link artist"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(event)
}

// canManageArtist reports whether the requester owns the artist or is an admin.
func (h *ArtistHandler) canManageArtist(r *http.Request, clerkID string, artist store.Artist) bool {
	if role, err := middleware.GetUserRole(r.Context(), clerkID); err == nil && role == middleware.RoleAdmin {
		return true
	}
	if !artist.OwnerUserID.Valid {
		return false
	}
	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		return false
	}
	return user.ID.Valid && user.ID.Bytes == artist.OwnerUserID.Bytes
}

func ensureMusicCategory(cats []string) []string {
	for _, c := range cats {
		if c == "Music" {
			return cats
		}
	}
	return append([]string{"Music"}, cats...)
}

// parseLatLng reads required lat/lng query params, writing a 400 on failure.
func parseLatLng(w http.ResponseWriter, r *http.Request) (lat, lng float64, ok bool) {
	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	if latStr == "" || lngStr == "" {
		http.Error(w, `{"error":"lat and lng are required"}`, http.StatusBadRequest)
		return 0, 0, false
	}
	var err error
	lat, err = strconv.ParseFloat(latStr, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid lat"}`, http.StatusBadRequest)
		return 0, 0, false
	}
	lng, err = strconv.ParseFloat(lngStr, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid lng"}`, http.StatusBadRequest)
		return 0, 0, false
	}
	return lat, lng, true
}
