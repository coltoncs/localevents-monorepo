package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/coltonsweeney/localevents/server/internal/handler"
)

// The validation branches return before touching the database, so a handler
// with nil queries exercises them safely.
func newSubscribeHandler() *handler.SubscribeHandler {
	return handler.NewSubscribeHandler(nil, nil, "https://919events.com", "")
}

func postSubscribe(t *testing.T, body any) *httptest.ResponseRecorder {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/subscribe", bytes.NewReader(raw))
	rr := httptest.NewRecorder()
	newSubscribeHandler().Subscribe(rr, req)
	return rr
}

// Each rejection must carry a distinct machine-readable `code`. The client
// collapses several of these into one message, so the code is the only way to
// tell them apart in logs and analytics after the fact.
func TestSubscribe_RejectionsCarryDistinctCodes(t *testing.T) {
	tests := []struct {
		name       string
		body       map[string]any
		wantStatus int
		wantCode   string
	}{
		{
			name:       "invalid email",
			body:       map[string]any{"email": "not-an-email", "latitude": 35.77, "longitude": -78.63},
			wantStatus: http.StatusBadRequest,
			wantCode:   "invalid_email",
		},
		{
			name:       "missing location",
			body:       map[string]any{"email": "a@example.com", "latitude": 0, "longitude": 0},
			wantStatus: http.StatusBadRequest,
			wantCode:   "missing_location",
		},
		{
			name:       "out of range coordinates",
			body:       map[string]any{"email": "a@example.com", "latitude": 120.0, "longitude": -78.63},
			wantStatus: http.StatusBadRequest,
			wantCode:   "invalid_coords",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := postSubscribe(t, tt.body)
			if rr.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", rr.Code, tt.wantStatus, rr.Body.String())
			}
			var out struct {
				Error string `json:"error"`
				Code  string `json:"code"`
			}
			if err := json.Unmarshal(rr.Body.Bytes(), &out); err != nil {
				t.Fatalf("response is not JSON: %v (body %s)", err, rr.Body.String())
			}
			if out.Code != tt.wantCode {
				t.Errorf("code = %q, want %q", out.Code, tt.wantCode)
			}
			if out.Error == "" {
				t.Error("error message is empty")
			}
		})
	}
}

func TestSubscribe_MalformedBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/subscribe", bytes.NewReader([]byte("{not json")))
	rr := httptest.NewRecorder()
	newSubscribeHandler().Subscribe(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rr.Code)
	}
	var out struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &out); err != nil {
		t.Fatalf("response is not JSON: %v (body %s)", err, rr.Body.String())
	}
	if out.Code != "bad_body" {
		t.Errorf("code = %q, want %q", out.Code, "bad_body")
	}
}
