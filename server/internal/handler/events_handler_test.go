package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/coltonsweeney/localevents/server/internal/handler"
	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/store"
	"github.com/coltonsweeney/localevents/server/internal/testutil"
)

// newEventRouter wires the EventHandler onto a chi mux with the same paths
// the production router uses, so tests exercise URL params and routing.
func newEventRouter(q *store.Queries) http.Handler {
	r := chi.NewRouter()
	h := handler.NewEventHandler(q, nil, nil)
	r.Get("/api/events", h.List)
	r.Get("/api/events/{id}", h.Get)
	r.Get("/api/events/{id}/save-count", h.SaveCount)
	r.Get("/api/events/series/{seriesId}", h.ListSeriesEvents)
	return r
}

type eventsListResponse struct {
	Events []store.Event `json:"events"`
	Total  int64         `json:"total"`
}

func TestEventsList_RequiresLatLng(t *testing.T) {
	_, q := testutil.NewTx(t)
	r := newEventRouter(q)

	req := httptest.NewRequest(http.MethodGet, "/api/events", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing coords, got %d", rr.Code)
	}
}

func TestEventsList_FiltersByDateAndRadius(t *testing.T) {
	_, q := testutil.NewTx(t)
	r := newEventRouter(q)

	// Use a fixed future date so the test isn't sensitive to "today".
	target := time.Now().Add(48 * time.Hour).Truncate(24 * time.Hour).Add(15 * time.Hour)
	wanted := testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "Wanted", StartTime: target,
	})
	testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "Other Day", StartTime: target.Add(7 * 24 * time.Hour),
	})

	q1 := url.Values{
		"lat":      {strconv.FormatFloat(testutil.DefaultLat, 'f', 6, 64)},
		"lng":      {strconv.FormatFloat(testutil.DefaultLng, 'f', 6, 64)},
		"radius":   {"25"},
		"date":     {target.Format("2006-01-02")},
		"end_date": {target.Format("2006-01-02")},
	}

	req := httptest.NewRequest(http.MethodGet, "/api/events?"+q1.Encode(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}

	var resp eventsListResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Events) == 0 {
		t.Fatal("expected at least one event in single-day window")
	}
	for _, e := range resp.Events {
		if e.Title == "Other Day" {
			t.Fatalf("event outside window leaked into results: %+v", e)
		}
	}
	found := false
	for _, e := range resp.Events {
		if e.ID == wanted.ID {
			found = true
		}
	}
	if !found {
		t.Fatalf("wanted event missing from results")
	}
}

func TestEventsGet_NotFound(t *testing.T) {
	_, q := testutil.NewTx(t)
	r := newEventRouter(q)

	req := httptest.NewRequest(http.MethodGet, "/api/events/"+uuid.New().String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
}

func TestEventsGet_InvalidID(t *testing.T) {
	_, q := testutil.NewTx(t)
	r := newEventRouter(q)

	req := httptest.NewRequest(http.MethodGet, "/api/events/not-a-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// CreateSeries opens its own transaction on the pool, which commits
// outside the testutil tx-rollback boundary. Tests therefore use the
// real pool and register cleanup that deletes the rows the handler
// created.

func TestEventsCreateSeries_CreatesAllInstancesWithSharedSeriesID(t *testing.T) {
	pool := testutil.Pool(t)
	q := store.New(pool)

	user := testutil.CreateUser(t, q, "")
	t.Cleanup(func() {
		ctx := context.Background()
		_, _ = pool.Exec(ctx, "DELETE FROM events WHERE submitted_by = $1", user.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", user.ID)
	})

	r := chi.NewRouter()
	h := handler.NewEventHandler(q, pool, nil)
	r.Post("/api/events/series", h.CreateSeries)

	day1 := time.Now().Add(48 * time.Hour).UTC().Truncate(time.Hour)
	day2 := day1.Add(24 * time.Hour)
	day3 := day1.Add(48 * time.Hour)
	endDay3 := day3.Add(2 * time.Hour)

	body := map[string]any{
		"base": map[string]any{
			"title":     "Three-Day Festival",
			"latitude":  testutil.DefaultLat,
			"longitude": testutil.DefaultLng,
		},
		"instances": []map[string]any{
			{"start_time": day1.Format(time.RFC3339)},
			{"start_time": day2.Format(time.RFC3339)},
			{
				"start_time": day3.Format(time.RFC3339),
				"end_time":   endDay3.Format(time.RFC3339),
			},
		},
	}
	buf, _ := json.Marshal(body)

	req := testutil.WithClerkIDAndRole(
		httptest.NewRequest(http.MethodPost, "/api/events/series", bytes.NewReader(buf)),
		user.ClerkID,
		middleware.RoleAuthor,
	)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", rr.Code, rr.Body.String())
	}

	var created []store.Event
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(created) != 3 {
		t.Fatalf("expected 3 events, got %d", len(created))
	}

	// All instances share the same generated series_id and base metadata.
	first := created[0]
	if !first.SeriesID.Valid {
		t.Fatal("series_id should be generated for multi-instance series")
	}
	for i, e := range created {
		if e.SeriesID != first.SeriesID {
			t.Fatalf("event %d series_id %v != %v", i, e.SeriesID, first.SeriesID)
		}
		if e.Title != "Three-Day Festival" {
			t.Fatalf("event %d title mismatch: %q", i, e.Title)
		}
	}

	// Ensure all three rows actually persisted (handler tx committed).
	rows, err := q.ListEventsBySeries(context.Background(), first.SeriesID)
	if err != nil {
		t.Fatalf("ListEventsBySeries: %v", err)
	}
	if len(rows) != 3 {
		t.Fatalf("expected 3 persisted events for series, got %d", len(rows))
	}
}

func TestEventsCreateSeries_SingleInstanceHasNoSeriesID(t *testing.T) {
	pool := testutil.Pool(t)
	q := store.New(pool)

	user := testutil.CreateUser(t, q, "")
	t.Cleanup(func() {
		ctx := context.Background()
		_, _ = pool.Exec(ctx, "DELETE FROM events WHERE submitted_by = $1", user.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", user.ID)
	})

	r := chi.NewRouter()
	h := handler.NewEventHandler(q, pool, nil)
	r.Post("/api/events/series", h.CreateSeries)

	start := time.Now().Add(48 * time.Hour).UTC().Truncate(time.Hour)
	body := map[string]any{
		"base": map[string]any{
			"title":     "One-Off",
			"latitude":  testutil.DefaultLat,
			"longitude": testutil.DefaultLng,
		},
		"instances": []map[string]any{
			{"start_time": start.Format(time.RFC3339)},
		},
	}
	buf, _ := json.Marshal(body)

	req := testutil.WithClerkIDAndRole(
		httptest.NewRequest(http.MethodPost, "/api/events/series", bytes.NewReader(buf)),
		user.ClerkID,
		middleware.RoleAuthor,
	)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", rr.Code, rr.Body.String())
	}

	var created []store.Event
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(created) != 1 {
		t.Fatalf("expected 1 event, got %d", len(created))
	}
	if created[0].SeriesID.Valid {
		t.Fatalf("single-instance call should not generate series_id, got %v", created[0].SeriesID)
	}
}

func TestEventsCreateSeries_ForbidsNonAuthor(t *testing.T) {
	pool := testutil.Pool(t)
	q := store.New(pool)

	user := testutil.CreateUser(t, q, "")
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", user.ID)
	})

	r := chi.NewRouter()
	h := handler.NewEventHandler(q, pool, nil)
	r.Post("/api/events/series", h.CreateSeries)

	body := map[string]any{
		"base": map[string]any{
			"title":     "Nope",
			"latitude":  testutil.DefaultLat,
			"longitude": testutil.DefaultLng,
		},
		"instances": []map[string]any{
			{"start_time": time.Now().Add(48 * time.Hour).Format(time.RFC3339)},
		},
	}
	buf, _ := json.Marshal(body)

	req := testutil.WithClerkIDAndRole(
		httptest.NewRequest(http.MethodPost, "/api/events/series", bytes.NewReader(buf)),
		user.ClerkID,
		middleware.RoleUser,
	)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for plain user, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestEventsCreateSeries_RejectsBadInput(t *testing.T) {
	pool := testutil.Pool(t)
	q := store.New(pool)

	user := testutil.CreateUser(t, q, "")
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", user.ID)
	})

	r := chi.NewRouter()
	h := handler.NewEventHandler(q, pool, nil)
	r.Post("/api/events/series", h.CreateSeries)

	cases := []struct {
		name string
		body map[string]any
	}{
		{
			name: "missing title",
			body: map[string]any{
				"base":      map[string]any{"latitude": testutil.DefaultLat, "longitude": testutil.DefaultLng},
				"instances": []map[string]any{{"start_time": time.Now().Add(48 * time.Hour).Format(time.RFC3339)}},
			},
		},
		{
			name: "no instances",
			body: map[string]any{
				"base":      map[string]any{"title": "Empty", "latitude": testutil.DefaultLat, "longitude": testutil.DefaultLng},
				"instances": []map[string]any{},
			},
		},
		{
			name: "bad start_time format",
			body: map[string]any{
				"base":      map[string]any{"title": "Bad time", "latitude": testutil.DefaultLat, "longitude": testutil.DefaultLng},
				"instances": []map[string]any{{"start_time": "not-a-date"}},
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			buf, _ := json.Marshal(tc.body)
			req := testutil.WithClerkIDAndRole(
				httptest.NewRequest(http.MethodPost, "/api/events/series", bytes.NewReader(buf)),
				user.ClerkID,
				middleware.RoleAuthor,
			)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)

			if rr.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d body=%s", rr.Code, rr.Body.String())
			}
		})
	}
}

func TestEventsSaveCount_ReflectsSaves(t *testing.T) {
	ctx, q := testutil.NewTx(t)
	r := newEventRouter(q)

	user := testutil.CreateUser(t, q, "")
	event := testutil.CreateEvent(t, q, testutil.EventOpts{})
	if _, err := q.SaveEvent(ctx, store.SaveEventParams{UserID: user.ID, EventID: event.ID}); err != nil {
		t.Fatalf("seed save: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/events/"+uuid.UUID(event.ID.Bytes).String()+"/save-count", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var body struct {
		Count int64 `json:"count"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Count != 1 {
		t.Fatalf("expected count 1, got %d", body.Count)
	}
}
