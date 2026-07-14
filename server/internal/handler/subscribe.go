package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/metrics"
	"github.com/coltonsweeney/localevents/server/internal/notifier"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

// SubscribeHandler powers the public, unauthenticated email-digest signup for
// anonymous users. Signups are double opt-in: a subscriber only starts
// receiving digests after clicking the confirmation link mailed at signup.
type SubscribeHandler struct {
	queries         *store.Queries
	email           *notifier.EmailSender
	frontendURL     string
	turnstileSecret string
	httpClient      *http.Client
}

func NewSubscribeHandler(q *store.Queries, email *notifier.EmailSender, frontendURL, turnstileSecret string) *SubscribeHandler {
	return &SubscribeHandler{
		queries:         q,
		email:           email,
		frontendURL:     frontendURL,
		turnstileSecret: turnstileSecret,
		httpClient:      metrics.NewInstrumentedClient("turnstile", 10*time.Second),
	}
}

var emailRegex = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

type subscribeRequest struct {
	Email          string  `json:"email"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	RadiusMiles    int32   `json:"radius_miles"`
	TurnstileToken string  `json:"turnstile_token"`
}

func (h *SubscribeHandler) Subscribe(w http.ResponseWriter, r *http.Request) {
	var req subscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if !emailRegex.MatchString(req.Email) {
		http.Error(w, `{"error":"a valid email is required"}`, http.StatusBadRequest)
		return
	}
	if req.Latitude == 0 && req.Longitude == 0 {
		http.Error(w, `{"error":"a location is required"}`, http.StatusBadRequest)
		return
	}
	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		http.Error(w, `{"error":"invalid coordinates"}`, http.StatusBadRequest)
		return
	}
	radius := req.RadiusMiles
	if radius <= 0 {
		radius = 25
	}

	// Verify the Turnstile token unless verification is disabled (no secret set,
	// e.g. local dev).
	if h.turnstileSecret != "" && !h.verifyTurnstile(r.Context(), req.TurnstileToken) {
		http.Error(w, `{"error":"captcha verification failed"}`, http.StatusForbidden)
		return
	}

	sub, err := h.queries.UpsertEmailSubscriber(r.Context(), store.UpsertEmailSubscriberParams{
		Email:       req.Email,
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		RadiusMiles: radius,
	})
	if err != nil {
		log.Printf("Subscribe: failed to upsert subscriber %s: %v", req.Email, err)
		http.Error(w, `{"error":"failed to subscribe"}`, http.StatusInternalServerError)
		return
	}

	// Already confirmed: this was just a location refresh, nothing to send.
	// Otherwise (re)send the confirmation email.
	if !sub.Confirmed {
		h.sendConfirmationEmail(sub.Email, uuidString(sub.ConfirmToken))
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"status": "check your email to confirm"})
}

func (h *SubscribeHandler) Confirm(w http.ResponseWriter, r *http.Request) {
	tokenStr := chi.URLParam(r, "token")
	token, err := uuid.Parse(tokenStr)
	if err != nil {
		h.renderConfirmPage(w, false)
		return
	}

	_, err = h.queries.ConfirmEmailSubscriber(r.Context(), pgtype.UUID{Bytes: token, Valid: true})
	h.renderConfirmPage(w, err == nil)
}

func (h *SubscribeHandler) sendConfirmationEmail(email, confirmToken string) {
	confirmURL := fmt.Sprintf("%s/api/subscribe/confirm/%s", h.frontendURL, confirmToken)
	if h.email == nil {
		// No Resend configured (local dev) — log the link so the flow is testable.
		log.Printf("Subscribe: email sender not configured; confirmation URL for %s: %s", email, confirmURL)
		return
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f4f4f4;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;padding:32px;border-radius:8px;">
<h1 style="color:#0d5c63;margin-top:0;">Confirm your weekly digest</h1>
<p style="color:#555;">Tap the button below to start getting a weekly email of events happening near you.</p>
<p style="text-align:center;margin:28px 0;">
<a href="%s" style="background:#0d5c63;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block;">Confirm subscription</a>
</p>
<p style="color:#999;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
</div>
</body>
</html>`, confirmURL)

	if err := h.email.Send(email, "Confirm your 919 Events weekly digest", html); err != nil {
		log.Printf("Subscribe: failed to send confirmation to %s: %v", email, err)
	}
}

// verifyTurnstile validates the client token against Cloudflare's siteverify API.
func (h *SubscribeHandler) verifyTurnstile(ctx context.Context, token string) bool {
	if token == "" {
		return false
	}

	form := url.Values{}
	form.Set("secret", h.turnstileSecret)
	form.Set("response", token)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://challenges.cloudflare.com/turnstile/v0/siteverify", strings.NewReader(form.Encode()))
	if err != nil {
		log.Printf("Subscribe: turnstile request build failed: %v", err)
		return false
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		log.Printf("Subscribe: turnstile verify request failed: %v", err)
		return false
	}
	defer resp.Body.Close()

	var out struct {
		Success bool `json:"success"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		log.Printf("Subscribe: turnstile response decode failed: %v", err)
		return false
	}
	return out.Success
}

func (h *SubscribeHandler) renderConfirmPage(w http.ResponseWriter, ok bool) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	heading, body := "Subscription confirmed", "You're all set — you'll get a weekly email of events near you every Friday."
	if !ok {
		heading, body = "Link invalid or expired", "This confirmation link is no longer valid. You can sign up again from the site."
	}
	fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>%s</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f4f4;">
<div style="text-align:center;background:#fff;padding:40px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
<h1 style="color:#0d5c63;">%s</h1>
<p style="color:#555;">%s</p>
<a href="%s" style="color:#0d5c63;">Back to 919 Events</a>
</div>
</body>
</html>`, heading, heading, body, h.frontendURL)
}

// uuidString renders a pgtype.UUID as its canonical string, or "" if invalid.
func uuidString(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	return uuid.UUID(id.Bytes).String()
}
