package handler

import (
	"encoding/json"
	"math/big"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/notifier"
	"github.com/coltonsweeney/localevents/server/internal/storage"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type EventHandler struct {
	queries *store.Queries
	pool    *pgxpool.Pool
	r2      *storage.R2Client
	alerter *notifier.AdminAlerter
}

func NewEventHandler(q *store.Queries, pool *pgxpool.Pool, r2 *storage.R2Client, alerter *notifier.AdminAlerter) *EventHandler {
	return &EventHandler{queries: q, pool: pool, r2: r2, alerter: alerter}
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

	radiusMiles := 10.0
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
	endDateStr := r.URL.Query().Get("end_date")
	var startDate, endDate time.Time
	if dateStr != "" {
		startDate, err = time.ParseInLocation("2006-01-02", dateStr, eastern)
		if err != nil {
			http.Error(w, `{"error":"invalid date format, use YYYY-MM-DD"}`, http.StatusBadRequest)
			return
		}
		if endDateStr != "" {
			endDate, err = time.ParseInLocation("2006-01-02", endDateStr, eastern)
			if err != nil {
				http.Error(w, `{"error":"invalid end_date format, use YYYY-MM-DD"}`, http.StatusBadRequest)
				return
			}
			// Include the full end date day
			endDate = endDate.Add(24 * time.Hour)
		} else {
			endDate = startDate.Add(24 * time.Hour)
		}
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

	var venueID pgtype.UUID
	if v := r.URL.Query().Get("venue_id"); v != "" {
		id, err := uuid.Parse(v)
		if err == nil {
			venueID = pgtype.UUID{Bytes: id, Valid: true}
		}
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
		VenueID:      venueID,
		Search:       search,
	}

	total, err := h.queries.CountEventsByLocation(r.Context(), locParams)
	if err != nil {
		http.Error(w, `{"error":"failed to count events"}`, http.StatusInternalServerError)
		return
	}

	listParams := store.ListEventsByLocationParams{
		Lng:          locParams.Lng,
		Lat:          locParams.Lat,
		RadiusMeters: locParams.RadiusMeters,
		StartDate:    locParams.StartDate,
		EndDate:      locParams.EndDate,
		Category:     locParams.Category,
		VenueName:    locParams.VenueName,
		VenueID:      locParams.VenueID,
		Search:       locParams.Search,
		EventLimit:   limit,
		EventOffset:  offset,
	}

	var events []store.Event
	multiDay := dateStr == "" || endDateStr != ""
	if multiDay {
		// Multi-day results: sort by day, then proximity, then time
		events, err = h.queries.ListEventsByLocationDateSorted(r.Context(), store.ListEventsByLocationDateSortedParams{
			Lng:          listParams.Lng,
			Lat:          listParams.Lat,
			RadiusMeters: listParams.RadiusMeters,
			StartDate:    listParams.StartDate,
			EndDate:      listParams.EndDate,
			Category:     listParams.Category,
			VenueName:    listParams.VenueName,
			VenueID:      listParams.VenueID,
			Search:       listParams.Search,
			EventLimit:   listParams.EventLimit,
			EventOffset:  listParams.EventOffset,
		})
	} else {
		// Date filter: sort by time, then proximity as tiebreaker
		events, err = h.queries.ListEventsByLocation(r.Context(), listParams)
	}
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

// ListMap returns up to 500 events in the radius without pagination.
// Used by map views, which need every pin in the area rather than a page slice.
func (h *EventHandler) ListMap(w http.ResponseWriter, r *http.Request) {
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

	radiusMiles := 10.0
	if v := r.URL.Query().Get("radius"); v != "" {
		radiusMiles, err = strconv.ParseFloat(v, 64)
		if err != nil {
			http.Error(w, `{"error":"invalid radius"}`, http.StatusBadRequest)
			return
		}
	}
	radiusMeters := radiusMiles * 1609.34

	eastern, _ := time.LoadLocation("America/New_York")

	dateStr := r.URL.Query().Get("date")
	endDateStr := r.URL.Query().Get("end_date")
	var startDate, endDate time.Time
	if dateStr != "" {
		startDate, err = time.ParseInLocation("2006-01-02", dateStr, eastern)
		if err != nil {
			http.Error(w, `{"error":"invalid date format, use YYYY-MM-DD"}`, http.StatusBadRequest)
			return
		}
		if endDateStr != "" {
			endDate, err = time.ParseInLocation("2006-01-02", endDateStr, eastern)
			if err != nil {
				http.Error(w, `{"error":"invalid end_date format, use YYYY-MM-DD"}`, http.StatusBadRequest)
				return
			}
			endDate = endDate.Add(24 * time.Hour)
		} else {
			endDate = startDate.Add(24 * time.Hour)
		}
	} else {
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

	var venueID pgtype.UUID
	if v := r.URL.Query().Get("venue_id"); v != "" {
		id, err := uuid.Parse(v)
		if err == nil {
			venueID = pgtype.UUID{Bytes: id, Valid: true}
		}
	}

	listParams := store.ListEventsByLocationParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMeters,
		StartDate:    pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:      pgtype.Timestamptz{Time: endDate, Valid: true},
		Category:     category,
		VenueName:    venueName,
		VenueID:      venueID,
		Search:       search,
		EventLimit:   500,
		EventOffset:  0,
	}

	var events []store.Event
	multiDay := dateStr == "" || endDateStr != ""
	if multiDay {
		events, err = h.queries.ListEventsByLocationDateSorted(r.Context(), store.ListEventsByLocationDateSortedParams{
			Lng:          listParams.Lng,
			Lat:          listParams.Lat,
			RadiusMeters: listParams.RadiusMeters,
			StartDate:    listParams.StartDate,
			EndDate:      listParams.EndDate,
			Category:     listParams.Category,
			VenueName:    listParams.VenueName,
			VenueID:      listParams.VenueID,
			Search:       listParams.Search,
			EventLimit:   listParams.EventLimit,
			EventOffset:  listParams.EventOffset,
		})
	} else {
		events, err = h.queries.ListEventsByLocation(r.Context(), listParams)
	}
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

// ListFeatured returns upcoming featured events near a location, soonest
// first. Public: drives the home page "Featured" section.
func (h *EventHandler) ListFeatured(w http.ResponseWriter, r *http.Request) {
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
		if parsed, err := strconv.ParseFloat(v, 64); err == nil {
			radiusMiles = parsed
		}
	}

	limit := int32(12)
	if v := r.URL.Query().Get("limit"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			if parsed > 50 {
				parsed = 50
			}
			limit = int32(parsed)
		}
	}

	events, err := h.queries.ListFeaturedEventsByLocation(r.Context(), store.ListFeaturedEventsByLocationParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMiles * 1609.34,
		EventLimit:   limit,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to query featured events"}`, http.StatusInternalServerError)
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
	Categories  []string `json:"categories"`
	ImageURL    *string  `json:"image_url"`
	TicketURL   *string  `json:"ticket_url"`
	PriceMin    *float64 `json:"price_min"`
	PriceMax    *float64 `json:"price_max"`
	IsFree      *bool    `json:"is_free"`
	VenueID     *string  `json:"venue_id"`
	SeriesID    *string  `json:"series_id"`
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

	// If no venue was selected but we have a name + coordinates, upsert a venue
	// so the event gets a linked venue page.
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

	// Mirror external image URL to R2 if available.
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
		Categories:  req.Categories,
		ImageUrl:    textFromPtr(req.ImageURL),
		TicketUrl:   textFromPtr(req.TicketURL),
		PriceMin:    numericFromFloat(req.PriceMin),
		PriceMax:    numericFromFloat(req.PriceMax),
		IsFree:      boolFromPtr(req.IsFree),
		SubmittedBy: user.ID,
		VenueID:     venueID,
		SeriesID:    uuidFromPtr(req.SeriesID),
	})
	if err != nil {
		http.Error(w, `{"error":"failed to create event"}`, http.StatusInternalServerError)
		return
	}

	location := event.VenueName.String
	if event.City.Valid && event.City.String != "" {
		if location != "" {
			location += " · "
		}
		location += event.City.String
		if event.State.Valid && event.State.String != "" {
			location += ", " + event.State.String
		}
	}
	h.alerter.NewEventSubmission(event.Title, location, user.Email.String)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(event)
}

type seriesInstance struct {
	StartTime string  `json:"start_time"`
	EndTime   *string `json:"end_time"`
}

type createSeriesRequest struct {
	Base      createEventRequest `json:"base"`
	Instances []seriesInstance   `json:"instances"`
}

// CreateSeries creates one or more events that share the same metadata
// (title, venue, location, image, etc.) but each have their own start/end
// time. All events are created in a single transaction — either every
// event is inserted or none are. When more than one instance is provided,
// they're linked by a generated series_id.
func (h *EventHandler) CreateSeries(w http.ResponseWriter, r *http.Request) {
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

	var req createSeriesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Base.Title == "" {
		http.Error(w, `{"error":"title is required"}`, http.StatusBadRequest)
		return
	}
	if len(req.Instances) == 0 {
		http.Error(w, `{"error":"at least one instance is required"}`, http.StatusBadRequest)
		return
	}

	type parsedInstance struct {
		start time.Time
		end   pgtype.Timestamptz
	}
	parsed := make([]parsedInstance, len(req.Instances))
	for i, inst := range req.Instances {
		startTime, err := time.Parse(time.RFC3339, inst.StartTime)
		if err != nil {
			http.Error(w, `{"error":"invalid start_time, use RFC3339 format"}`, http.StatusBadRequest)
			return
		}
		var endTime pgtype.Timestamptz
		if inst.EndTime != nil {
			t, err := time.Parse(time.RFC3339, *inst.EndTime)
			if err != nil {
				http.Error(w, `{"error":"invalid end_time, use RFC3339 format"}`, http.StatusBadRequest)
				return
			}
			endTime = pgtype.Timestamptz{Time: t, Valid: true}
		}
		parsed[i] = parsedInstance{start: startTime, end: endTime}
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	// Upsert venue once for the whole series so we don't redo it per instance.
	venueID := uuidFromPtr(req.Base.VenueID)
	if req.Base.VenueID == nil && req.Base.VenueName != nil && *req.Base.VenueName != "" &&
		(req.Base.Latitude != 0 || req.Base.Longitude != 0) {
		venue, err := h.queries.UpsertVenue(r.Context(), store.UpsertVenueParams{
			Name:      *req.Base.VenueName,
			Address:   textFromPtr(req.Base.Address),
			City:      textFromPtr(req.Base.City),
			State:     textFromPtr(req.Base.State),
			Zip:       textFromPtr(req.Base.Zip),
			Latitude:  req.Base.Latitude,
			Longitude: req.Base.Longitude,
		})
		if err == nil {
			venueID = venue.ID
		}
	}

	// Mirror image once for the whole series.
	if h.r2 != nil && req.Base.ImageURL != nil && *req.Base.ImageURL != "" {
		if r2URL, err := h.r2.MirrorImage(r.Context(), *req.Base.ImageURL); err == nil && r2URL != "" {
			req.Base.ImageURL = &r2URL
		}
	}

	// Generate a series_id when there's more than one instance and the
	// caller didn't supply one. Single-instance calls behave like Create.
	seriesID := uuidFromPtr(req.Base.SeriesID)
	if !seriesID.Valid && len(req.Instances) > 1 {
		seriesID = pgtype.UUID{Bytes: uuid.New(), Valid: true}
	}

	tx, err := h.pool.BeginTx(r.Context(), pgx.TxOptions{})
	if err != nil {
		http.Error(w, `{"error":"failed to begin transaction"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	qtx := h.queries.WithTx(tx)
	created := make([]store.Event, 0, len(parsed))
	for _, inst := range parsed {
		event, err := qtx.CreateEvent(r.Context(), store.CreateEventParams{
			Source:      "user",
			Title:       req.Base.Title,
			Description: textFromPtr(req.Base.Description),
			VenueName:   textFromPtr(req.Base.VenueName),
			Address:     textFromPtr(req.Base.Address),
			City:        textFromPtr(req.Base.City),
			State:       textFromPtr(req.Base.State),
			Zip:         textFromPtr(req.Base.Zip),
			Latitude:    req.Base.Latitude,
			Longitude:   req.Base.Longitude,
			StartTime:   pgtype.Timestamptz{Time: inst.start, Valid: true},
			EndTime:     inst.end,
			Categories:  req.Base.Categories,
			ImageUrl:    textFromPtr(req.Base.ImageURL),
			TicketUrl:   textFromPtr(req.Base.TicketURL),
			PriceMin:    numericFromFloat(req.Base.PriceMin),
			PriceMax:    numericFromFloat(req.Base.PriceMax),
			IsFree:      boolFromPtr(req.Base.IsFree),
			SubmittedBy: user.ID,
			VenueID:     venueID,
			SeriesID:    seriesID,
		})
		if err != nil {
			http.Error(w, `{"error":"failed to create event"}`, http.StatusInternalServerError)
			return
		}
		created = append(created, event)
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, `{"error":"failed to commit series"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
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

func boolFromPtr(b *bool) bool {
	return b != nil && *b
}

func uuidFromPtr(s *string) pgtype.UUID {
	if s == nil || *s == "" {
		return pgtype.UUID{}
	}
	id, err := uuid.Parse(*s)
	if err != nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: id, Valid: true}
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

	// Mirror external image URL to R2 if available.
	if h.r2 != nil && req.ImageURL != nil && *req.ImageURL != "" {
		if r2URL, err := h.r2.MirrorImage(r.Context(), *req.ImageURL); err == nil && r2URL != "" {
			req.ImageURL = &r2URL
		}
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
		Categories:  req.Categories,
		ImageUrl:    textFromPtr(req.ImageURL),
		TicketUrl:   textFromPtr(req.TicketURL),
		PriceMin:    numericFromFloat(req.PriceMin),
		PriceMax:    numericFromFloat(req.PriceMax),
		IsFree:      boolFromPtr(req.IsFree),
		VenueID:     uuidFromPtr(req.VenueID),
	})
	if err != nil {
		http.Error(w, `{"error":"failed to update event"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

// monthlyFeatureLimit caps how many distinct events a user may feature per
// calendar month. Admins are exempt. Consumed slots are not refunded when an
// event is un-featured (featured_at/featured_by are retained).
const monthlyFeatureLimit = 3

// Feature marks an event as featured. Any subscriber (feature_events
// entitlement) may feature any event, capped at monthlyFeatureLimit per
// calendar month; admins are exempt from both the subscription and the cap.
func (h *EventHandler) Feature(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid event id"}`, http.StatusBadRequest)
		return
	}
	pgID := pgtype.UUID{Bytes: id, Valid: true}

	role, err := middleware.GetUserRole(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"failed to check role"}`, http.StatusInternalServerError)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	// Non-admins must hold the feature_events entitlement and stay under the
	// monthly cap. Admins bypass both.
	if role != middleware.RoleAdmin {
		if !middleware.HasFeature(r.Context(), "feature_events") {
			http.Error(w, `{"error":"subscription_required"}`, http.StatusPaymentRequired)
			return
		}

		// Count this user's other events already featured this month; featuring
		// this one would make the (count+1)th. Re-featuring an event they
		// already featured this month is free (it's excluded by id).
		count, err := h.queries.CountFeaturedThisMonth(r.Context(), store.CountFeaturedThisMonthParams{
			FeaturedBy: user.ID,
			ID:         pgID,
		})
		if err != nil {
			http.Error(w, `{"error":"failed to check feature limit"}`, http.StatusInternalServerError)
			return
		}
		if count >= monthlyFeatureLimit {
			http.Error(w, `{"error":"feature_limit_reached"}`, http.StatusForbidden)
			return
		}
	}

	updated, err := h.queries.FeatureEvent(r.Context(), store.FeatureEventParams{
		ID:         pgID,
		FeaturedBy: user.ID,
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, `{"error":"event not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to update event"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

// Unfeature clears the featured flag (featured_at/featured_by are retained as
// an audit trail). Only the user who featured the event, or an admin, may
// un-feature it.
func (h *EventHandler) Unfeature(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
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

	if role != middleware.RoleAdmin {
		user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
		if err != nil {
			http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
			return
		}
		if !event.FeaturedBy.Valid || event.FeaturedBy.Bytes != user.ID.Bytes {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
	}

	updated, err := h.queries.UnfeatureEvent(r.Context(), pgID)
	if err != nil {
		http.Error(w, `{"error":"failed to update event"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

// ListMyFeatured returns the events the current user currently has featured.
func (h *EventHandler) ListMyFeatured(w http.ResponseWriter, r *http.Request) {
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

	events, err := h.queries.ListMyFeaturedEvents(r.Context(), user.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to list featured events"}`, http.StatusInternalServerError)
		return
	}
	if events == nil {
		events = []store.Event{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

// FeatureQuota reports how many events the current user has featured this
// calendar month and how many remain before hitting monthlyFeatureLimit.
// Admins are uncapped (Unlimited=true).
func (h *EventHandler) FeatureQuota(w http.ResponseWriter, r *http.Request) {
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

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	used, err := h.queries.CountMyFeaturedThisMonth(r.Context(), user.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to check feature quota"}`, http.StatusInternalServerError)
		return
	}

	remaining := int64(monthlyFeatureLimit) - used
	if remaining < 0 {
		remaining = 0
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Used      int64 `json:"used"`
		Limit     int   `json:"limit"`
		Remaining int64 `json:"remaining"`
		Unlimited bool  `json:"unlimited"`
	}{
		Used:      used,
		Limit:     monthlyFeatureLimit,
		Remaining: remaining,
		Unlimited: role == middleware.RoleAdmin,
	})
}

func (h *EventHandler) SaveCount(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid event id"}`, http.StatusBadRequest)
		return
	}

	count, err := h.queries.GetEventSaveCount(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"failed to get save count"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Count int64 `json:"count"`
	}{Count: count})
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

	// Track the deletion so scraped events don't get re-inserted
	if event.ExternalID.Valid && event.ExternalID.String != "" {
		_ = h.queries.TrackDeletedExternalEvent(r.Context(), store.TrackDeletedExternalEventParams{
			Source:     event.Source,
			ExternalID: event.ExternalID.String,
		})
	}

	if err := h.queries.DeleteEvent(r.Context(), pgID); err != nil {
		http.Error(w, `{"error":"failed to delete event"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *EventHandler) ListSeriesEvents(w http.ResponseWriter, r *http.Request) {
	seriesIDStr := chi.URLParam(r, "seriesId")
	seriesID, err := uuid.Parse(seriesIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid series id"}`, http.StatusBadRequest)
		return
	}

	events, err := h.queries.ListEventsBySeries(r.Context(), pgtype.UUID{Bytes: seriesID, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"failed to query series events"}`, http.StatusInternalServerError)
		return
	}
	if events == nil {
		events = []store.Event{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

func (h *EventHandler) UpdateSeries(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	seriesIDStr := chi.URLParam(r, "seriesId")
	seriesID, err := uuid.Parse(seriesIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid series id"}`, http.StatusBadRequest)
		return
	}
	pgSeriesID := pgtype.UUID{Bytes: seriesID, Valid: true}

	// Fetch series to verify ownership.
	events, err := h.queries.ListEventsBySeries(r.Context(), pgSeriesID)
	if err != nil || len(events) == 0 {
		http.Error(w, `{"error":"series not found"}`, http.StatusNotFound)
		return
	}

	role, err := middleware.GetUserRole(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"failed to check role"}`, http.StatusInternalServerError)
		return
	}

	var ownerClerkID string
	if events[0].SubmittedBy.Valid {
		owner, err := h.queries.GetUserByID(r.Context(), events[0].SubmittedBy)
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

	// Mirror external image URL to R2 if available.
	if h.r2 != nil && req.ImageURL != nil && *req.ImageURL != "" {
		if r2URL, err := h.r2.MirrorImage(r.Context(), *req.ImageURL); err == nil && r2URL != "" {
			req.ImageURL = &r2URL
		}
	}

	updated, err := h.queries.UpdateEventsBySeries(r.Context(), store.UpdateEventsBySeriesParams{
		SeriesID:    pgSeriesID,
		Title:       req.Title,
		Description: textFromPtr(req.Description),
		VenueName:   textFromPtr(req.VenueName),
		Address:     textFromPtr(req.Address),
		City:        textFromPtr(req.City),
		State:       textFromPtr(req.State),
		Zip:         textFromPtr(req.Zip),
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		Categories:  req.Categories,
		ImageUrl:    textFromPtr(req.ImageURL),
		TicketUrl:   textFromPtr(req.TicketURL),
		PriceMin:    numericFromFloat(req.PriceMin),
		PriceMax:    numericFromFloat(req.PriceMax),
		IsFree:      boolFromPtr(req.IsFree),
		VenueID:     uuidFromPtr(req.VenueID),
	})
	if err != nil {
		http.Error(w, `{"error":"failed to update series"}`, http.StatusInternalServerError)
		return
	}
	if updated == nil {
		updated = []store.Event{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}
