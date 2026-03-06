package handler

import (
	"encoding/json"
	"math/big"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type EventHandler struct {
	queries *store.Queries
}

func NewEventHandler(q *store.Queries) *EventHandler {
	return &EventHandler{queries: q}
}

func (h *EventHandler) List(w http.ResponseWriter, r *http.Request) {
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

	radiusMiles := 25.0
	if v := r.URL.Query().Get("radius"); v != "" {
		radiusMiles, err = strconv.ParseFloat(v, 64)
		if err != nil {
			http.Error(w, `{"error":"invalid radius"}`, http.StatusBadRequest)
			return
		}
	}
	radiusMeters := radiusMiles * 1609.34

	// Use US Eastern as default timezone for date range queries.
	// Events are predominantly in the Eastern US; parsing dates in UTC
	// causes previous-day evening events to bleed into the selected date.
	eastern, _ := time.LoadLocation("America/New_York")

	dateStr := r.URL.Query().Get("date")
	var startDate, endDate time.Time
	if dateStr != "" {
		startDate, err = time.ParseInLocation("2006-01-02", dateStr, eastern)
		if err != nil {
			http.Error(w, `{"error":"invalid date format, use YYYY-MM-DD"}`, http.StatusBadRequest)
			return
		}
		endDate = startDate.Add(24 * time.Hour)
	} else {
		// No date specified: return all events from today forward
		now := time.Now().In(eastern)
		startDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, eastern)
		endDate = startDate.AddDate(1, 0, 0)
	}

	var category pgtype.Text
	if c := r.URL.Query().Get("category"); c != "" {
		category = pgtype.Text{String: c, Valid: true}
	}

	var venueName pgtype.Text
	if v := r.URL.Query().Get("venue"); v != "" {
		venueName = pgtype.Text{String: v, Valid: true}
	}

	var search pgtype.Text
	if s := r.URL.Query().Get("search"); s != "" {
		search = pgtype.Text{String: s, Valid: true}
	}

	limit := int32(20)
	if v := r.URL.Query().Get("limit"); v != "" {
		l, err := strconv.Atoi(v)
		if err == nil && l > 0 && l <= 500 {
			limit = int32(l)
		}
	}

	offset := int32(0)
	if v := r.URL.Query().Get("page"); v != "" {
		p, err := strconv.Atoi(v)
		if err == nil && p > 1 {
			offset = int32(p-1) * limit
		}
	}

	locParams := store.CountEventsByLocationParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMeters,
		StartDate:    pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:      pgtype.Timestamptz{Time: endDate, Valid: true},
		Category:     category,
		VenueName:    venueName,
		Search:       search,
	}

	total, err := h.queries.CountEventsByLocation(r.Context(), locParams)
	if err != nil {
		http.Error(w, `{"error":"failed to count events"}`, http.StatusInternalServerError)
		return
	}

	events, err := h.queries.ListEventsByLocation(r.Context(), store.ListEventsByLocationParams{
		Lng:          locParams.Lng,
		Lat:          locParams.Lat,
		RadiusMeters: locParams.RadiusMeters,
		StartDate:    locParams.StartDate,
		EndDate:      locParams.EndDate,
		Category:     locParams.Category,
		VenueName:    locParams.VenueName,
		Search:       locParams.Search,
		EventLimit:   limit,
		EventOffset:  offset,
	})
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
		Total  int64         `json:"total"`
	}{Events: events, Total: total})
}

func (h *EventHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid event id"}`, http.StatusBadRequest)
		return
	}

	event, err := h.queries.GetEvent(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"event not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(event)
}

type createEventRequest struct {
	Title       string   `json:"title"`
	Description *string  `json:"description"`
	VenueName   *string  `json:"venue_name"`
	Address     *string  `json:"address"`
	City        *string  `json:"city"`
	State       *string  `json:"state"`
	Zip         *string  `json:"zip"`
	Latitude    float64  `json:"latitude"`
	Longitude   float64  `json:"longitude"`
	StartTime   string   `json:"start_time"`
	EndTime     *string  `json:"end_time"`
	Category    *string  `json:"category"`
	ImageURL    *string  `json:"image_url"`
	TicketURL   *string  `json:"ticket_url"`
	PriceMin    *float64 `json:"price_min"`
	PriceMax    *float64 `json:"price_max"`
}

func (h *EventHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
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
		Category:    textFromPtr(req.Category),
		ImageUrl:    textFromPtr(req.ImageURL),
		TicketUrl:   textFromPtr(req.TicketURL),
		PriceMin:    numericFromFloat(req.PriceMin),
		PriceMax:    numericFromFloat(req.PriceMax),
		SubmittedBy: user.ID,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to create event"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(event)
}

func textFromPtr(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func numericFromFloat(f *float64) pgtype.Numeric {
	if f == nil {
		return pgtype.Numeric{}
	}
	cents := int64(*f * 100)
	return pgtype.Numeric{
		Int:   big.NewInt(cents),
		Exp:   -2,
		Valid: true,
	}
}

func (h *EventHandler) Update(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid event id"}`, http.StatusBadRequest)
		return
	}
	pgID := pgtype.UUID{Bytes: id, Valid: true}

	event, err := h.queries.GetEvent(r.Context(), pgID)
	if err != nil {
		http.Error(w, `{"error":"event not found"}`, http.StatusNotFound)
		return
	}

	role, err := middleware.GetUserRole(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"failed to check role"}`, http.StatusInternalServerError)
		return
	}

	// Look up the event owner's clerk_id
	var ownerClerkID string
	if event.SubmittedBy.Valid {
		owner, err := h.queries.GetUserByID(r.Context(), event.SubmittedBy)
		if err == nil {
			ownerClerkID = owner.ClerkID
		}
	}

	if !middleware.CanModifyEvent(role, ownerClerkID, clerkID) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
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

	updated, err := h.queries.UpdateEvent(r.Context(), store.UpdateEventParams{
		ID:          pgID,
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
		Category:    textFromPtr(req.Category),
		ImageUrl:    textFromPtr(req.ImageURL),
		TicketUrl:   textFromPtr(req.TicketURL),
		PriceMin:    numericFromFloat(req.PriceMin),
		PriceMax:    numericFromFloat(req.PriceMax),
	})
	if err != nil {
		http.Error(w, `{"error":"failed to update event"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (h *EventHandler) Delete(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid event id"}`, http.StatusBadRequest)
		return
	}
	pgID := pgtype.UUID{Bytes: id, Valid: true}

	event, err := h.queries.GetEvent(r.Context(), pgID)
	if err != nil {
		http.Error(w, `{"error":"event not found"}`, http.StatusNotFound)
		return
	}

	role, err := middleware.GetUserRole(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"failed to check role"}`, http.StatusInternalServerError)
		return
	}

	var ownerClerkID string
	if event.SubmittedBy.Valid {
		owner, err := h.queries.GetUserByID(r.Context(), event.SubmittedBy)
		if err == nil {
			ownerClerkID = owner.ClerkID
		}
	}

	if !middleware.CanModifyEvent(role, ownerClerkID, clerkID) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	if err := h.queries.DeleteEvent(r.Context(), pgID); err != nil {
		http.Error(w, `{"error":"failed to delete event"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
