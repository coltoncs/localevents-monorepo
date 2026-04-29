package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/coltonsweeney/localevents/server/internal/handler"
	"github.com/coltonsweeney/localevents/server/internal/store"
	"github.com/coltonsweeney/localevents/server/internal/testutil"
)

// newUserRouter mounts only the user routes that don't require a Clerk SDK
// roundtrip — GetMe is excluded because it fetches the email from Clerk.
func newUserRouter(q *store.Queries) http.Handler {
	r := chi.NewRouter()
	h := handler.NewUserHandler(q)
	r.Put("/api/me", h.UpdateMe)
	r.Get("/api/me/events", h.ListMyEvents)
	r.Get("/api/me/saved", h.ListSaved)
	r.Post("/api/me/saved/{eventId}", h.SaveEvent)
	r.Delete("/api/me/saved/{eventId}", h.UnsaveEvent)
	return r
}

func TestSaveEvent_RequiresAuth(t *testing.T) {
	_, q := testutil.NewTx(t)
	r := newUserRouter(q)

	event := testutil.CreateEvent(t, q, testutil.EventOpts{})
	req := httptest.NewRequest(http.MethodPost, "/api/me/saved/"+uuid.UUID(event.ID.Bytes).String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without auth, got %d", rr.Code)
	}
}

func TestSaveEvent_PersistsAndAppearsInListSaved(t *testing.T) {
	_, q := testutil.NewTx(t)
	r := newUserRouter(q)

	user := testutil.CreateUser(t, q, "")
	event := testutil.CreateEvent(t, q, testutil.EventOpts{})

	saveReq := testutil.WithClerkID(
		httptest.NewRequest(http.MethodPost, "/api/me/saved/"+uuid.UUID(event.ID.Bytes).String(), nil),
		user.ClerkID,
	)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, saveReq)
	if rr.Code != http.StatusCreated {
		t.Fatalf("save: expected 201, got %d body=%s", rr.Code, rr.Body.String())
	}

	listReq := testutil.WithClerkID(httptest.NewRequest(http.MethodGet, "/api/me/saved", nil), user.ClerkID)
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, listReq)
	if rr.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", rr.Code)
	}

	var saved []store.Event
	if err := json.Unmarshal(rr.Body.Bytes(), &saved); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(saved) != 1 || saved[0].ID != event.ID {
		t.Fatalf("expected saved event to be returned, got %+v", saved)
	}
}

func TestUnsaveEvent_RemovesFromList(t *testing.T) {
	ctx, q := testutil.NewTx(t)
	r := newUserRouter(q)

	user := testutil.CreateUser(t, q, "")
	event := testutil.CreateEvent(t, q, testutil.EventOpts{})
	if _, err := q.SaveEvent(ctx, store.SaveEventParams{UserID: user.ID, EventID: event.ID}); err != nil {
		t.Fatalf("seed save: %v", err)
	}

	delReq := testutil.WithClerkID(
		httptest.NewRequest(http.MethodDelete, "/api/me/saved/"+uuid.UUID(event.ID.Bytes).String(), nil),
		user.ClerkID,
	)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, delReq)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rr.Code)
	}

	count, err := q.GetEventSaveCount(ctx, event.ID)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected 0 saves after unsave, got %d", count)
	}
}

func TestUpdateMe_PersistsLocationDefaults(t *testing.T) {
	ctx, q := testutil.NewTx(t)
	r := newUserRouter(q)

	user := testutil.CreateUser(t, q, "")

	body, _ := json.Marshal(map[string]any{
		"default_latitude":     35.7796,
		"default_longitude":    -78.6382,
		"default_radius_miles": 30,
	})
	req := testutil.WithClerkID(
		httptest.NewRequest(http.MethodPut, "/api/me", bytes.NewReader(body)),
		user.ClerkID,
	)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}

	updated, err := q.GetUserByClerkID(ctx, user.ClerkID)
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	if !updated.DefaultLatitude.Valid || updated.DefaultLatitude.Float64 != 35.7796 {
		t.Fatalf("latitude not persisted: %+v", updated.DefaultLatitude)
	}
	if !updated.DefaultRadiusMiles.Valid || updated.DefaultRadiusMiles.Int32 != 30 {
		t.Fatalf("radius not persisted: %+v", updated.DefaultRadiusMiles)
	}
}

func TestListMyEvents_OnlyReturnsOwnSubmissions(t *testing.T) {
	_, q := testutil.NewTx(t)
	r := newUserRouter(q)

	owner := testutil.CreateUser(t, q, "")
	other := testutil.CreateUser(t, q, "")
	mine := testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "mine", SubmittedBy: owner.ID,
	})
	testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "theirs", SubmittedBy: other.ID,
	})

	req := testutil.WithClerkID(httptest.NewRequest(http.MethodGet, "/api/me/events", nil), owner.ClerkID)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var events []store.Event
	if err := json.Unmarshal(rr.Body.Bytes(), &events); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(events) != 1 || events[0].ID != mine.ID {
		t.Fatalf("expected only owner's event, got %+v", events)
	}
}
