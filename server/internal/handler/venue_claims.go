package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/notifier"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type VenueClaimHandler struct {
	queries *store.Queries
	alerter *notifier.AdminAlerter
}

func NewVenueClaimHandler(q *store.Queries, alerter *notifier.AdminAlerter) *VenueClaimHandler {
	return &VenueClaimHandler{queries: q, alerter: alerter}
}

type submitVenueClaimRequest struct {
	// VenueID set => claiming an existing venue. Empty => proposing a new one.
	VenueID      *string  `json:"venue_id"`
	VenueName    string   `json:"venue_name"`
	Address      *string  `json:"address"`
	City         *string  `json:"city"`
	State        *string  `json:"state"`
	Zip          *string  `json:"zip"`
	Latitude     *float64 `json:"latitude"`
	Longitude    *float64 `json:"longitude"`
	ContactName  string   `json:"contact_name"`
	ContactEmail string   `json:"contact_email"`
	BookingEmail *string  `json:"booking_email"`
	Message      *string  `json:"message"`
}

func float8FromPtr(f *float64) pgtype.Float8 {
	if f == nil {
		return pgtype.Float8{}
	}
	return pgtype.Float8{Float64: *f, Valid: true}
}

func (h *VenueClaimHandler) Submit(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req submitVenueClaimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.ContactName == "" || req.ContactEmail == "" {
		http.Error(w, `{"error":"contact name and email are required"}`, http.StatusBadRequest)
		return
	}

	var venueID pgtype.UUID
	venueName := req.VenueName
	mode := "new venue"

	if req.VenueID != nil && *req.VenueID != "" {
		id, err := uuid.Parse(*req.VenueID)
		if err != nil {
			http.Error(w, `{"error":"invalid venue id"}`, http.StatusBadRequest)
			return
		}
		venueID = pgtype.UUID{Bytes: id, Valid: true}

		venue, err := h.queries.GetVenue(r.Context(), venueID)
		if err != nil {
			http.Error(w, `{"error":"venue not found"}`, http.StatusNotFound)
			return
		}
		venueName = venue.Name
		mode = "claim existing"

		// Block a second pending claim on the same venue.
		if _, err := h.queries.GetPendingVenueClaimForVenue(r.Context(), venueID); err == nil {
			http.Error(w, `{"error":"this venue already has a pending claim"}`, http.StatusConflict)
			return
		}
	} else if venueName == "" {
		http.Error(w, `{"error":"venue name is required"}`, http.StatusBadRequest)
		return
	}

	claim, err := h.queries.CreateVenueClaim(r.Context(), store.CreateVenueClaimParams{
		ClerkID:      clerkID,
		VenueID:      venueID,
		VenueName:    venueName,
		Address:      textFromPtr(req.Address),
		City:         textFromPtr(req.City),
		State:        textFromPtr(req.State),
		Zip:          textFromPtr(req.Zip),
		Latitude:     float8FromPtr(req.Latitude),
		Longitude:    float8FromPtr(req.Longitude),
		ContactName:  req.ContactName,
		ContactEmail: req.ContactEmail,
		BookingEmail: textFromPtr(req.BookingEmail),
		Message:      textFromPtr(req.Message),
	})
	if err != nil {
		http.Error(w, `{"error":"failed to create venue claim"}`, http.StatusInternalServerError)
		return
	}

	h.alerter.NewVenueClaim(venueName, mode, req.ContactName, req.ContactEmail, textOrEmpty(req.Message))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(claim)
}

func (h *VenueClaimHandler) ListMine(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	claims, err := h.queries.ListVenueClaimsByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"failed to list claims"}`, http.StatusInternalServerError)
		return
	}
	if claims == nil {
		claims = []store.VenueClaim{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(claims)
}

func (h *VenueClaimHandler) ListPending(w http.ResponseWriter, r *http.Request) {
	claims, err := h.queries.ListPendingVenueClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to list claims"}`, http.StatusInternalServerError)
		return
	}
	if claims == nil {
		claims = []store.VenueClaim{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(claims)
}

// Approve links the venue to the claimant: for a claim-existing request it
// claims the referenced venue; for a propose-new request it creates the venue
// first. The venue is marked claimed with the claimant as owner and booking
// enabled when a booking email was supplied.
func (h *VenueClaimHandler) Approve(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid claim id"}`, http.StatusBadRequest)
		return
	}

	var req reviewRequest
	json.NewDecoder(r.Body).Decode(&req)

	claim, err := h.queries.GetVenueClaim(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"claim not found"}`, http.StatusNotFound)
		return
	}

	// Resolve the owning user (internal id) from the claimant's clerk id.
	owner, err := h.queries.GetUserByClerkID(r.Context(), claim.ClerkID)
	if err != nil {
		http.Error(w, `{"error":"claimant user not found"}`, http.StatusNotFound)
		return
	}

	bookingEmail := claim.BookingEmail.String
	acceptsBooking := bookingEmail != ""

	// Determine the venue: existing (claim.VenueID) or newly created.
	venueID := claim.VenueID
	if !venueID.Valid {
		venue, err := h.queries.CreateVenue(r.Context(), store.CreateVenueParams{
			Name:                   claim.VenueName,
			Address:                claim.Address,
			City:                   claim.City,
			State:                  claim.State,
			Zip:                    claim.Zip,
			Latitude:               claim.Latitude.Float64,
			Longitude:              claim.Longitude.Float64,
			BookingEmail:           claim.BookingEmail,
			AcceptsBookingRequests: acceptsBooking,
		})
		if err != nil {
			http.Error(w, `{"error":"failed to create venue"}`, http.StatusInternalServerError)
			return
		}
		venueID = venue.ID
	}

	if _, err := h.queries.ClaimVenue(r.Context(), store.ClaimVenueParams{
		ID:                     venueID,
		OwnerUserID:            owner.ID,
		NewBookingEmail:        bookingEmail,
		AcceptsBookingRequests: acceptsBooking,
	}); err != nil {
		http.Error(w, `{"error":"failed to claim venue"}`, http.StatusInternalServerError)
		return
	}

	updated, err := h.queries.ApproveVenueClaim(r.Context(), store.ApproveVenueClaimParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		VenueID:     venueID,
		ReviewedBy:  pgtype.Text{String: clerkID, Valid: true},
		ReviewNotes: pgtype.Text{String: req.ReviewNotes, Valid: req.ReviewNotes != ""},
	})
	if err != nil {
		http.Error(w, `{"error":"failed to approve claim"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (h *VenueClaimHandler) Reject(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid claim id"}`, http.StatusBadRequest)
		return
	}

	var req reviewRequest
	json.NewDecoder(r.Body).Decode(&req)

	updated, err := h.queries.RejectVenueClaim(r.Context(), store.RejectVenueClaimParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		ReviewedBy:  pgtype.Text{String: clerkID, Valid: true},
		ReviewNotes: pgtype.Text{String: req.ReviewNotes, Valid: req.ReviewNotes != ""},
	})
	if err != nil {
		http.Error(w, `{"error":"failed to reject claim"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func textOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
