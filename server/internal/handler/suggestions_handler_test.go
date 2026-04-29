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

func newSuggestionRouter(q *store.Queries) http.Handler {
	r := chi.NewRouter()
	h := handler.NewSuggestionHandler(q)
	r.Post("/api/suggestions", h.Create)
	return r
}

func TestSuggestionsCreate_RejectsUnknownTargetType(t *testing.T) {
	_, q := testutil.NewTx(t)
	r := newSuggestionRouter(q)

	user := testutil.CreateUser(t, q, "")
	body, _ := json.Marshal(map[string]any{
		"target_type":      "thingamajig",
		"target_id":        uuid.New().String(),
		"proposed_changes": map[string]any{"title": "x"},
	})
	req := testutil.WithClerkID(
		httptest.NewRequest(http.MethodPost, "/api/suggestions", bytes.NewReader(body)),
		user.ClerkID,
	)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestSuggestionsCreate_EditEvent(t *testing.T) {
	_, q := testutil.NewTx(t)
	r := newSuggestionRouter(q)

	user := testutil.CreateUser(t, q, "")
	event := testutil.CreateEvent(t, q, testutil.EventOpts{Title: "Original"})

	body, _ := json.Marshal(map[string]any{
		"target_type":      "event",
		"target_id":        uuid.UUID(event.ID.Bytes).String(),
		"proposed_changes": map[string]any{"title": "Better Title"},
	})
	req := testutil.WithClerkID(
		httptest.NewRequest(http.MethodPost, "/api/suggestions", bytes.NewReader(body)),
		user.ClerkID,
	)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestSuggestionsCreate_RejectsUnknownField(t *testing.T) {
	_, q := testutil.NewTx(t)
	r := newSuggestionRouter(q)

	user := testutil.CreateUser(t, q, "")
	event := testutil.CreateEvent(t, q, testutil.EventOpts{})

	body, _ := json.Marshal(map[string]any{
		"target_type":      "event",
		"target_id":        uuid.UUID(event.ID.Bytes).String(),
		"proposed_changes": map[string]any{"made_up_field": "x"},
	})
	req := testutil.WithClerkID(
		httptest.NewRequest(http.MethodPost, "/api/suggestions", bytes.NewReader(body)),
		user.ClerkID,
	)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestSuggestionsCreate_RequiresAuth(t *testing.T) {
	_, q := testutil.NewTx(t)
	r := newSuggestionRouter(q)

	body, _ := json.Marshal(map[string]any{
		"target_type":      "event",
		"target_id":        uuid.New().String(),
		"proposed_changes": map[string]any{"title": "x"},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/suggestions", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}
