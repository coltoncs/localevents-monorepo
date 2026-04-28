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

var allowedPlaceFields = map[string]bool{
	"name": true, "is_food": true, "is_drink": true,
	"cuisine": true, "bar_type": true,
	"address": true, "city": true, "state": true, "zip": true,
	"latitude": true, "longitude": true,
	"phone": true, "website": true, "hours": true, "description": true,
	"review": true, "image_url": true, "tags": true, "price_level": true,
}

type createSuggestionRequest struct {
	TargetType      string                 `json:"target_type"`
	TargetID        string                 `json:"target_id,omitempty"`
	Action          string                 `json:"action,omitempty"`
	Reason          string                 `json:"reason,omitempty"`
	ProposedChanges map[string]interface{} `json:"proposed_changes"`
}

type suggestionResponse struct {
	ID              string                 `json:"ID"`
	TargetType      string                 `json:"TargetType"`
	TargetID        string                 `json:"TargetID,omitempty"`
	SubmittedBy     string                 `json:"SubmittedBy"`
	Action          string                 `json:"Action"`
	Reason          string                 `json:"Reason,omitempty"`
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
		SubmittedBy:     uuid.UUID(s.SubmittedBy.Bytes).String(),
		Action:          s.Action,
		ProposedChanges: changes,
		Status:          s.Status,
		CreatedAt:       s.CreatedAt.Time,
	}
	if s.TargetID.Valid {
		resp.TargetID = uuid.UUID(s.TargetID.Bytes).String()
	}
	if s.Reason.Valid {
		resp.Reason = s.Reason.String
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

	if req.TargetType != "event" && req.TargetType != "venue" && req.TargetType != "place" {
		http.Error(w, `{"error":"target_type must be event, venue, or place"}`, http.StatusBadRequest)
		return
	}

	action := req.Action
	if action == "" {
		action = "edit"
	}
	if action != "edit" && action != "create" && action != "delete" {
		http.Error(w, `{"error":"action must be edit, create, or delete"}`, http.StatusBadRequest)
		return
	}
	if (action == "create" || action == "delete") && req.TargetType != "place" {
		http.Error(w, `{"error":"create and delete actions are only supported for places"}`, http.StatusBadRequest)
		return
	}

	var pgTargetID pgtype.UUID
	if action == "edit" || action == "delete" {
		targetID, err := uuid.Parse(req.TargetID)
		if err != nil {
			http.Error(w, `{"error":"invalid target_id"}`, http.StatusBadRequest)
			return
		}
		pgTargetID = pgtype.UUID{Bytes: targetID, Valid: true}
	}

	switch action {
	case "edit":
		if len(req.ProposedChanges) == 0 {
			http.Error(w, `{"error":"proposed_changes must not be empty"}`, http.StatusBadRequest)
			return
		}
		allowed := allowedEventFields
		if req.TargetType == "venue" {
			allowed = allowedVenueFields
		} else if req.TargetType == "place" {
			allowed = allowedPlaceFields
		}
		for key := range req.ProposedChanges {
			if !allowed[key] {
				http.Error(w, `{"error":"unrecognized field: `+key+`"}`, http.StatusBadRequest)
				return
			}
		}
		switch req.TargetType {
		case "event":
			if _, err := h.queries.GetEvent(r.Context(), pgTargetID); err != nil {
				http.Error(w, `{"error":"event not found"}`, http.StatusNotFound)
				return
			}
		case "venue":
			if _, err := h.queries.GetVenue(r.Context(), pgTargetID); err != nil {
				http.Error(w, `{"error":"venue not found"}`, http.StatusNotFound)
				return
			}
		case "place":
			if _, err := h.queries.GetPlace(r.Context(), pgTargetID); err != nil {
				http.Error(w, `{"error":"place not found"}`, http.StatusNotFound)
				return
			}
		}

	case "create":
		if len(req.ProposedChanges) == 0 {
			http.Error(w, `{"error":"proposed_changes must not be empty"}`, http.StatusBadRequest)
			return
		}
		for key := range req.ProposedChanges {
			if !allowedPlaceFields[key] {
				http.Error(w, `{"error":"unrecognized field: `+key+`"}`, http.StatusBadRequest)
				return
			}
		}
		name, _ := req.ProposedChanges["name"].(string)
		if name == "" {
			http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
			return
		}
		isFood, _ := req.ProposedChanges["is_food"].(bool)
		isDrink, _ := req.ProposedChanges["is_drink"].(bool)
		if !isFood && !isDrink {
			http.Error(w, `{"error":"place must be tagged as food, drink, or both"}`, http.StatusBadRequest)
			return
		}
		if isFood {
			cuisine, _ := req.ProposedChanges["cuisine"].(string)
			if !validateCuisine(cuisine) {
				http.Error(w, `{"error":"cuisine is required for food places"}`, http.StatusBadRequest)
				return
			}
		}
		if isDrink {
			barType, _ := req.ProposedChanges["bar_type"].(string)
			if !validateBarType(barType) {
				http.Error(w, `{"error":"bar_type must be brewery or bar for drink places"}`, http.StatusBadRequest)
				return
			}
		}
		if _, ok := req.ProposedChanges["latitude"].(float64); !ok {
			http.Error(w, `{"error":"latitude is required"}`, http.StatusBadRequest)
			return
		}
		if _, ok := req.ProposedChanges["longitude"].(float64); !ok {
			http.Error(w, `{"error":"longitude is required"}`, http.StatusBadRequest)
			return
		}

	case "delete":
		if req.Reason == "" {
			http.Error(w, `{"error":"reason is required for delete suggestions"}`, http.StatusBadRequest)
			return
		}
		if req.TargetType == "place" {
			if _, err := h.queries.GetPlace(r.Context(), pgTargetID); err != nil {
				http.Error(w, `{"error":"place not found"}`, http.StatusNotFound)
				return
			}
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
		Action:          action,
		Reason:          pgtype.Text{String: req.Reason, Valid: req.Reason != ""},
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

	switch suggestion.Action {
	case "", "edit":
		switch suggestion.TargetType {
		case "event":
			if err := h.applyEventChanges(r, suggestion.TargetID, changes); err != nil {
				http.Error(w, `{"error":"failed to apply changes: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		case "venue":
			if err := h.applyVenueChanges(r, suggestion.TargetID, changes); err != nil {
				http.Error(w, `{"error":"failed to apply changes: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		case "place":
			if err := h.applyPlaceChanges(r, suggestion.TargetID, changes); err != nil {
				http.Error(w, `{"error":"failed to apply changes: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	case "create":
		if suggestion.TargetType != "place" {
			http.Error(w, `{"error":"only place creates are supported"}`, http.StatusBadRequest)
			return
		}
		if err := h.applyPlaceCreate(r, changes); err != nil {
			http.Error(w, `{"error":"failed to create place: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
	case "delete":
		if suggestion.TargetType != "place" {
			http.Error(w, `{"error":"only place deletes are supported"}`, http.StatusBadRequest)
			return
		}
		if err := h.queries.DeletePlace(r.Context(), suggestion.TargetID); err != nil {
			http.Error(w, `{"error":"failed to delete place: `+err.Error()+`"}`, http.StatusInternalServerError)
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
	switch targetType {
	case "event":
		event, err := h.queries.GetEvent(r.Context(), targetID)
		if err == nil {
			return event.Title
		}
	case "venue":
		venue, err := h.queries.GetVenue(r.Context(), targetID)
		if err == nil {
			return venue.Name
		}
	case "place":
		place, err := h.queries.GetPlace(r.Context(), targetID)
		if err == nil {
			return place.Name
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

func (h *SuggestionHandler) applyPlaceChanges(r *http.Request, targetID pgtype.UUID, changes map[string]interface{}) error {
	place, err := h.queries.GetPlace(r.Context(), targetID)
	if err != nil {
		return err
	}

	params := store.UpdatePlaceParams{
		ID:          targetID,
		Name:        place.Name,
		IsFood:      place.IsFood,
		IsDrink:     place.IsDrink,
		Cuisine:     place.Cuisine,
		BarType:     place.BarType,
		Address:     place.Address,
		City:        place.City,
		State:       place.State,
		Zip:         place.Zip,
		Latitude:    place.Latitude,
		Longitude:   place.Longitude,
		Phone:       place.Phone,
		Website:     place.Website,
		Hours:       place.Hours,
		Description: place.Description,
		Review:      place.Review,
		ImageUrl:    place.ImageUrl,
		Tags:        place.Tags,
		PriceLevel:  place.PriceLevel,
	}

	for key, val := range changes {
		str, _ := val.(string)
		switch key {
		case "name":
			params.Name = str
		case "is_food":
			if b, ok := val.(bool); ok {
				params.IsFood = b
			}
		case "is_drink":
			if b, ok := val.(bool); ok {
				params.IsDrink = b
			}
		case "cuisine":
			if validateCuisine(str) {
				params.Cuisine = pgtype.Text{String: str, Valid: true}
			}
		case "bar_type":
			if validateBarType(str) {
				params.BarType = pgtype.Text{String: str, Valid: true}
			}
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
		case "phone":
			params.Phone = pgtype.Text{String: str, Valid: str != ""}
		case "website":
			params.Website = pgtype.Text{String: str, Valid: str != ""}
		case "hours":
			params.Hours = pgtype.Text{String: str, Valid: str != ""}
		case "description":
			params.Description = pgtype.Text{String: str, Valid: str != ""}
		case "review":
			params.Review = pgtype.Text{String: str, Valid: str != ""}
		case "image_url":
			params.ImageUrl = pgtype.Text{String: str, Valid: str != ""}
		case "tags":
			if arr, ok := val.([]interface{}); ok {
				tags := make([]string, 0, len(arr))
				for _, v := range arr {
					if s, ok := v.(string); ok {
						tags = append(tags, s)
					}
				}
				params.Tags = tags
			}
		case "price_level":
			if f, ok := val.(float64); ok {
				params.PriceLevel = pgtype.Int4{Int32: int32(f), Valid: true}
			} else if val == nil {
				params.PriceLevel = pgtype.Int4{}
			}
		}
	}

	if !params.IsFood {
		params.Cuisine = pgtype.Text{}
	}
	if !params.IsDrink {
		params.BarType = pgtype.Text{}
	}

	_, err = h.queries.UpdatePlace(r.Context(), params)
	return err
}

func (h *SuggestionHandler) applyPlaceCreate(r *http.Request, changes map[string]interface{}) error {
	getStr := func(k string) pgtype.Text {
		s, _ := changes[k].(string)
		return pgtype.Text{String: s, Valid: s != ""}
	}

	name, _ := changes["name"].(string)
	isFood, _ := changes["is_food"].(bool)
	isDrink, _ := changes["is_drink"].(bool)
	lat, _ := changes["latitude"].(float64)
	lng, _ := changes["longitude"].(float64)

	var cuisine, barType pgtype.Text
	if isFood {
		c, _ := changes["cuisine"].(string)
		cuisine = pgtype.Text{String: c, Valid: c != ""}
	}
	if isDrink {
		t, _ := changes["bar_type"].(string)
		barType = pgtype.Text{String: t, Valid: t != ""}
	}

	params := store.CreatePlaceParams{
		Name:        name,
		IsFood:      isFood,
		IsDrink:     isDrink,
		Cuisine:     cuisine,
		BarType:     barType,
		Address:     getStr("address"),
		City:        getStr("city"),
		State:       getStr("state"),
		Zip:         getStr("zip"),
		Latitude:    lat,
		Longitude:   lng,
		Phone:       getStr("phone"),
		Website:     getStr("website"),
		Hours:       getStr("hours"),
		Description: getStr("description"),
		Review:      getStr("review"),
		ImageUrl:    getStr("image_url"),
	}

	if arr, ok := changes["tags"].([]interface{}); ok {
		tags := make([]string, 0, len(arr))
		for _, v := range arr {
			if s, ok := v.(string); ok {
				tags = append(tags, s)
			}
		}
		params.Tags = tags
	}
	if f, ok := changes["price_level"].(float64); ok {
		params.PriceLevel = pgtype.Int4{Int32: int32(f), Valid: true}
	}

	_, err := h.queries.CreatePlace(r.Context(), params)
	return err
}
