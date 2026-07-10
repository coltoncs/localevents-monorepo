package handler

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

// DeviceHandler manages Expo push-token registrations from the mobile app.
type DeviceHandler struct {
	queries *store.Queries
}

func NewDeviceHandler(q *store.Queries) *DeviceHandler {
	return &DeviceHandler{queries: q}
}

type registerDeviceRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform"`
}

// Register upserts an Expo push token for the signed-in user. Re-registering
// an existing token reassigns it (e.g. a device that switched accounts).
func (h *DeviceHandler) Register(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req registerDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		http.Error(w, `{"error":"token is required"}`, http.StatusBadRequest)
		return
	}
	if req.Platform != "ios" && req.Platform != "android" {
		http.Error(w, `{"error":"platform must be \"ios\" or \"android\""}`, http.StatusBadRequest)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	if _, err := h.queries.UpsertDeviceToken(r.Context(), store.UpsertDeviceTokenParams{
		UserID:   user.ID,
		Token:    req.Token,
		Platform: req.Platform,
	}); err != nil {
		http.Error(w, `{"error":"failed to register device"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Unregister deletes a push token owned by the signed-in user. Deleting a
// token that doesn't exist (or belongs to someone else) is a no-op 204 so
// clients can call it idempotently on sign-out.
func (h *DeviceHandler) Unregister(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Expo tokens look like "ExponentPushToken[xxx]"; clients may percent-encode
	// the brackets in the path.
	token := chi.URLParam(r, "token")
	if decoded, err := url.PathUnescape(token); err == nil {
		token = decoded
	}
	token = strings.TrimSpace(token)
	if token == "" {
		http.Error(w, `{"error":"token is required"}`, http.StatusBadRequest)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	if err := h.queries.DeleteDeviceToken(r.Context(), store.DeleteDeviceTokenParams{
		Token:  token,
		UserID: user.ID,
	}); err != nil {
		http.Error(w, `{"error":"failed to unregister device"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
