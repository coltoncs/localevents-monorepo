package handler

import (
	"encoding/json"
	"net/http"
)

// HealthHandler reports liveness plus the handful of config flags that have to
// agree with the deployed frontend. Those flags exist because the frontend is
// built by a separate pipeline (Cloudflare Workers Builds, with its own set of
// build variables): if the server enforces a captcha the frontend was not built
// to render, every submission fails and neither side can detect it locally.
// Publishing the server's view makes that mismatch a single-request check.
type HealthHandler struct {
	turnstileEnforced bool
}

func NewHealthHandler(turnstileSecret string) *HealthHandler {
	return &HealthHandler{turnstileEnforced: turnstileSecret != ""}
}

func (h *HealthHandler) Check(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status": "ok",
		// True means /api/subscribe rejects any request without a valid
		// Turnstile token — so the frontend must be built with
		// VITE_TURNSTILE_SITE_KEY set, or it will never send one.
		"turnstile_enforced": h.turnstileEnforced,
	})
}
