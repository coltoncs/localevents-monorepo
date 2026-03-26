package handler

import (
	"encoding/json"
	"math/big"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type SuggestionHandler struct {
	queries *store.Queries
}

func NewSuggestionHandler(q *store.Queries) *SuggestionHandler {
	return &SuggestionHandler{queries: q}
}

var allowedEventFields = map[string]bool{
	"title": true, "description": true, "venue_name": true,
	"address": true, "city": true, "state": true, "zip": true,
	"latitude": true, "longitude": true,
	"start_time": true, "end_time": true, "categories": true,
	"image_url": true, "ticket_url": true,
	"price_min": true, "price_max": true,
}

var allowedVenueFields = map[string]bool{
	"name": true, "address": true, "city": true, "state": true, "zip": true,
	"latitude": true, "longitude": true,
	"hours": true, "description": true,
}

type createSuggestionRequest struct {
	TargetType      string                 `json:"target_type"`
	TargetID        string                 `json:"target_id"`
	ProposedChanges map[string]interface{} `json:"proposed_changes"`
}

type suggestionResponse struct {
	ID              string                 `json:"ID"`
	TargetType      string                 `json:"TargetType"`
	TargetID        string                 `json:"TargetID"`
	SubmittedBy     string                 `json:"SubmittedBy"`
	ProposedChanges map[string]interface{} `json:"ProposedChanges"`
	Status          string                 `json:"Status"`
	ReviewNotes     string                 `json:"ReviewNotes,omitempty"`
	ReviewedBy      string                 `json:"ReviewedBy,omitempty"`
	CreatedAt       time.Time              `json:"CreatedAt"`
	ReviewedAt      *time.Time             `json:"ReviewedAt,omitempty"`
	TargetName      string                 `json:"TargetName,omitempty"`
}

func suggestionToResponse(s store.EditSuggestion) suggestionResponse {
	var changes map[string]interface{}
	json.Unmarshal(s.ProposedChanges, &changes)

	resp := suggestionResponse{
		ID:              uuid.UUID(s.ID.Bytes).String(),
		TargetType:      s.TargetType,
		TargetID:        uuid.UUID(s.TargetID.Bytes).String(),
		SubmittedBy:     uuid.UUID(s.SubmittedBy.Bytes).String(),
		ProposedChanges: changes,
		Status:          s.Status,
		CreatedAt:       s.CreatedAt.Time,
	}
	if s.ReviewNotes.Valid {
		resp.ReviewNotes = s.ReviewNotes.String
	}
	if s.ReviewedBy.Valid {
		resp.ReviewedBy = s.ReviewedBy.String
	}
	if s.ReviewedAt.Valid {
		resp.ReviewedAt = &s.ReviewedAt.Time
	}
	return resp
}

func (h *SuggestionHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req createSuggestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.TargetType != "event" && req.TargetType != "venue" {
		http.Error(w, `{"error":"target_type must be event or venue"}`, http.StatusBadRequest)
		return
	}

	targetID, err := uuid.Parse(req.TargetID)
	if err != nil {
		http.Error(w, `{"error":"invalid target_id"}`, http.StatusBadRequest)
		return
	}
	pgTargetID := pgtype.UUID{Bytes: targetID, Valid: true}

	if len(req.ProposedChanges) == 0 {
		http.Error(w, `{"error":"proposed_changes must not be empty"}`, http.StatusBadRequest)
		return
	}

	// Validate field names
	allowed := allowedEventFields
	if req.TargetType == "venue" {
		allowed = allowedVenueFields
	}
	for key := range req.ProposedChanges {
		if !allowed[key] {
			http.Error(w, `{"error":"unrecognized field: `+key+`"}`, http.StatusBadRequest)
			return
		}
	}

	// Verify target exists
	if req.TargetType == "event" {
		if _, err := h.queries.GetEvent(r.Context(), pgTargetID); err != nil {
			http.Error(w, `{"error":"event not found"}`, http.StatusNotFound)
			return
		}
	} else {
		if _, err := h.queries.GetVenue(r.Context(), pgTargetID); err != nil {
			http.Error(w, `{"error":"venue not found"}`, http.StatusNotFound)
			return
		}
	}

	changesJSON, err := json.Marshal(req.ProposedChanges)
	if err != nil {
		http.Error(w, `{"error":"failed to encode changes"}`, http.StatusInternalServerError)
		return
	}

	suggestion, err := h.queries.CreateEditSuggestion(r.Context(), store.CreateEditSuggestionParams{
		TargetType:      req.TargetType,
		TargetID:        pgTargetID,
		SubmittedBy:     user.ID,
		ProposedChanges: changesJSON,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to create suggestion"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(suggestionToResponse(suggestion))
}

func (h *SuggestionHandler) ListPending(w http.ResponseWriter, r *http.Request) {
	suggestions, err := h.queries.ListPendingEditSuggestions(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to list suggestions"}`, http.StatusInternalServerError)
		return
	}

	resp := make([]suggestionResponse, 0, len(suggestions))
	for _, s := range suggestions {
		sr := suggestionToResponse(s)
		sr.TargetName = h.resolveTargetName(r, s.TargetType, s.TargetID)
		resp = append(resp, sr)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *SuggestionHandler) ListMyEventSuggestions(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	suggestions, err := h.queries.ListPendingEditSuggestionsForAuthor(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"failed to list suggestions"}`, http.StatusInternalServerError)
		return
	}

	resp := make([]suggestionResponse, 0, len(suggestions))
	for _, s := range suggestions {
		sr := suggestionToResponse(s)
		sr.TargetName = h.resolveTargetName(r, s.TargetType, s.TargetID)
		resp = append(resp, sr)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *SuggestionHandler) Approve(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid suggestion id"}`, http.StatusBadRequest)
		return
	}

	suggestion, err := h.queries.GetEditSuggestion(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"suggestion not found"}`, http.StatusNotFound)
		return
	}

	if suggestion.Status != "pending" {
		http.Error(w, `{"error":"suggestion already reviewed"}`, http.StatusConflict)
		return
	}

	// Authorization: admin can approve anything; author can approve suggestions on their own events
	role, err := middleware.GetUserRole(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"failed to check role"}`, http.StatusInternalServerError)
		return
	}

	if role != middleware.RoleAdmin {
		if suggestion.TargetType != "event" {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		event, err := h.queries.GetEvent(r.Context(), suggestion.TargetID)
		if err != nil {
			http.Error(w, `{"error":"target event not found"}`, http.StatusNotFound)
			return
		}
		if !event.SubmittedBy.Valid {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		owner, err := h.queries.GetUserByID(r.Context(), event.SubmittedBy)
		if err != nil || owner.ClerkID != clerkID {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
	}

	// Apply the changes
	var changes map[string]interface{}
	if err := json.Unmarshal(suggestion.ProposedChanges, &changes); err != nil {
		http.Error(w, `{"error":"failed to parse proposed changes"}`, http.StatusInternalServerError)
		return
	}

	if suggestion.TargetType == "event" {
		if err := h.applyEventChanges(r, suggestion.TargetID, changes); err != nil {
			http.Error(w, `{"error":"failed to apply changes: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
	} else {
		if err := h.applyVenueChanges(r, suggestion.TargetID, changes); err != nil {
			http.Error(w, `{"error":"failed to apply changes: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
	}

	var req reviewRequest
	json.NewDecoder(r.Body).Decode(&req)

	approved, err := h.queries.ApproveEditSuggestion(r.Context(), store.ApproveEditSuggestionParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		ReviewedBy:  pgtype.Text{String: clerkID, Valid: true},
		ReviewNotes: pgtype.Text{String: req.ReviewNotes, Valid: req.ReviewNotes != ""},
	})
	if err != nil {
		http.Error(w, `{"error":"changes applied but failed to update suggestion status"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suggestionToResponse(approved))
}

func (h *SuggestionHandler) Reject(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid suggestion id"}`, http.StatusBadRequest)
		return
	}

	suggestion, err := h.queries.GetEditSuggestion(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"suggestion not found"}`, http.StatusNotFound)
		return
	}

	if suggestion.Status != "pending" {
		http.Error(w, `{"error":"suggestion already reviewed"}`, http.StatusConflict)
		return
	}

	// Authorization: same as approve
	role, err := middleware.GetUserRole(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"failed to check role"}`, http.StatusInternalServerError)
		return
	}

	if role != middleware.RoleAdmin {
		if suggestion.TargetType != "event" {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		event, err := h.queries.GetEvent(r.Context(), suggestion.TargetID)
		if err != nil {
			http.Error(w, `{"error":"target event not found"}`, http.StatusNotFound)
			return
		}
		if !event.SubmittedBy.Valid {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		owner, err := h.queries.GetUserByID(r.Context(), event.SubmittedBy)
		if err != nil || owner.ClerkID != clerkID {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
	}

	var req reviewRequest
	json.NewDecoder(r.Body).Decode(&req)

	rejected, err := h.queries.RejectEditSuggestion(r.Context(), store.RejectEditSuggestionParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		ReviewedBy:  pgtype.Text{String: clerkID, Valid: true},
		ReviewNotes: pgtype.Text{String: req.ReviewNotes, Valid: req.ReviewNotes != ""},
	})
	if err != nil {
		http.Error(w, `{"error":"failed to reject suggestion"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suggestionToResponse(rejected))
}

// resolveTargetName fetches the display name for a suggestion's target.
func (h *SuggestionHandler) resolveTargetName(r *http.Request, targetType string, targetID pgtype.UUID) string {
	if targetType == "event" {
		event, err := h.queries.GetEvent(r.Context(), targetID)
		if err == nil {
			return event.Title
		}
	} else {
		venue, err := h.queries.GetVenue(r.Context(), targetID)
		if err == nil {
			return venue.Name
		}
	}
	return ""
}

// applyEventChanges merges proposed changes into the existing event.
func (h *SuggestionHandler) applyEventChanges(r *http.Request, targetID pgtype.UUID, changes map[string]interface{}) error {
	event, err := h.queries.GetEvent(r.Context(), targetID)
	if err != nil {
		return err
	}

	// Start with current values
	params := store.UpdateEventParams{
		ID:          targetID,
		Title:       event.Title,
		Description: event.Description,
		VenueName:   event.VenueName,
		Address:     event.Address,
		City:        event.City,
		State:       event.State,
		Zip:         event.Zip,
		Latitude:    event.Latitude,
		Longitude:   event.Longitude,
		StartTime:   event.StartTime,
		EndTime:     event.EndTime,
		Categories:  event.Categories,
		ImageUrl:    event.ImageUrl,
		TicketUrl:   event.TicketUrl,
		PriceMin:    event.PriceMin,
		PriceMax:    event.PriceMax,
		VenueID:     event.VenueID,
	}

	// Override only changed fields
	for key, val := range changes {
		str, _ := val.(string)
		switch key {
		case "title":
			params.Title = str
		case "description":
			params.Description = pgtype.Text{String: str, Valid: str != ""}
		case "venue_name":
			params.VenueName = pgtype.Text{String: str, Valid: str != ""}
		case "address":
			params.Address = pgtype.Text{String: str, Valid: str != ""}
		case "city":
			params.City = pgtype.Text{String: str, Valid: str != ""}
		case "state":
			params.State = pgtype.Text{String: str, Valid: str != ""}
		case "zip":
			params.Zip = pgtype.Text{String: str, Valid: str != ""}
		case "latitude":
			if f, ok := val.(float64); ok {
				params.Latitude = f
			}
		case "longitude":
			if f, ok := val.(float64); ok {
				params.Longitude = f
			}
		case "start_time":
			if t, err := time.Parse(time.RFC3339, str); err == nil {
				params.StartTime = pgtype.Timestamptz{Time: t, Valid: true}
			}
		case "end_time":
			if str == "" {
				params.EndTime = pgtype.Timestamptz{}
			} else if t, err := time.Parse(time.RFC3339, str); err == nil {
				params.EndTime = pgtype.Timestamptz{Time: t, Valid: true}
			}
		case "categories":
			if arr, ok := val.([]interface{}); ok {
				cats := make([]string, 0, len(arr))
				for _, v := range arr {
					if s, ok := v.(string); ok {
						cats = append(cats, s)
					}
				}
				params.Categories = cats
			}
		case "image_url":
			params.ImageUrl = pgtype.Text{String: str, Valid: str != ""}
		case "ticket_url":
			params.TicketUrl = pgtype.Text{String: str, Valid: str != ""}
		case "price_min":
			if f, ok := val.(float64); ok {
				cents := int64(f * 100)
				params.PriceMin = pgtype.Numeric{Int: big.NewInt(cents), Exp: -2, Valid: true}
			} else if val == nil {
				params.PriceMin = pgtype.Numeric{}
			}
		case "price_max":
			if f, ok := val.(float64); ok {
				cents := int64(f * 100)
				params.PriceMax = pgtype.Numeric{Int: big.NewInt(cents), Exp: -2, Valid: true}
			} else if val == nil {
				params.PriceMax = pgtype.Numeric{}
			}
		}
	}

	_, err = h.queries.UpdateEvent(r.Context(), params)
	return err
}

// applyVenueChanges merges proposed changes into the existing venue.
func (h *SuggestionHandler) applyVenueChanges(r *http.Request, targetID pgtype.UUID, changes map[string]interface{}) error {
	venue, err := h.queries.GetVenue(r.Context(), targetID)
	if err != nil {
		return err
	}

	params := store.UpdateVenueParams{
		ID:          targetID,
		Name:        venue.Name,
		Address:     venue.Address,
		City:        venue.City,
		State:       venue.State,
		Zip:         venue.Zip,
		Latitude:    venue.Latitude,
		Longitude:   venue.Longitude,
		Hours:       venue.Hours,
		Description: venue.Description,
	}

	for key, val := range changes {
		str, _ := val.(string)
		switch key {
		case "name":
			params.Name = str
		case "address":
			params.Address = pgtype.Text{String: str, Valid: str != ""}
		case "city":
			params.City = pgtype.Text{String: str, Valid: str != ""}
		case "state":
			params.State = pgtype.Text{String: str, Valid: str != ""}
		case "zip":
			params.Zip = pgtype.Text{String: str, Valid: str != ""}
		case "latitude":
			if f, ok := val.(float64); ok {
				params.Latitude = f
			}
		case "longitude":
			if f, ok := val.(float64); ok {
				params.Longitude = f
			}
		case "hours":
			params.Hours = pgtype.Text{String: str, Valid: str != ""}
		case "description":
			params.Description = pgtype.Text{String: str, Valid: str != ""}
		}
	}

	_, err = h.queries.UpdateVenue(r.Context(), params)
	return err
}
