package handler_test

import (
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
	"github.com/coltonsweeney/localevents/server/internal/store"
	"github.com/coltonsweeney/localevents/server/internal/testutil"
)

// newEventRouter wires the EventHandler onto a chi mux with the same paths
// the production router uses, so tests exercise URL params and routing.
func newEventRouter(q *store.Queries) http.Handler {
	r := chi.NewRouter()
	h := handler.NewEventHandler(q, nil)
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
