package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
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
	queries     *store.Queries
	email       *notifier.EmailSender
	frontendURL string
	// apiURL is this server's own public base URL. The confirmation link points
	// at a backend route, and only the Vite dev server proxies /api to it — in
	// production frontendURL is the Cloudflare Worker, which 404s that path.
	apiURL          string
	turnstileSecret string
	httpClient      *http.Client
}

func NewSubscribeHandler(q *store.Queries, email *notifier.EmailSender, frontendURL, apiURL, turnstileSecret string) *SubscribeHandler {
	return &SubscribeHandler{
		queries:         q,
		email:           email,
		frontendURL:     frontendURL,
		apiURL:          apiURL,
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

// fail records a signup failure against the digest_subscribe_total counter,
// logs a single line carrying every field needed to reconstruct the attempt,
// and writes the client response. Every non-success exit from Subscribe goes
// through here so no failure mode can be silent — the generic "Something went
// wrong" the user sees always has a matching, attributable server-side record.
func failSubscribe(w http.ResponseWriter, r *http.Request, outcome string, status int, clientMsg, detail string) {
	metrics.DigestSubscribeTotal.WithLabelValues(outcome).Inc()
	log.Printf("Subscribe: rejected outcome=%s status=%d ip=%s ua=%q detail=%s",
		outcome, status, clientIPForLog(r), r.UserAgent(), detail)
	http.Error(w, fmt.Sprintf(`{"error":%q,"code":%q}`, clientMsg, outcome), status)
}

func (h *SubscribeHandler) Subscribe(w http.ResponseWriter, r *http.Request) {
	var req subscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		failSubscribe(w, r, "bad_body", http.StatusBadRequest,
			"invalid request body", fmt.Sprintf("decode: %v", err))
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if !emailRegex.MatchString(req.Email) {
		failSubscribe(w, r, "invalid_email", http.StatusBadRequest,
			"a valid email is required", "email="+maskEmail(req.Email))
		return
	}
	if req.Latitude == 0 && req.Longitude == 0 {
		failSubscribe(w, r, "missing_location", http.StatusBadRequest,
			"a location is required", "email="+maskEmail(req.Email))
		return
	}
	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		failSubscribe(w, r, "invalid_coords", http.StatusBadRequest, "invalid coordinates",
			fmt.Sprintf("email=%s lat=%f lng=%f", maskEmail(req.Email), req.Latitude, req.Longitude))
		return
	}
	radius := req.RadiusMiles
	if radius <= 0 {
		radius = defaultCoverageRadiusMiles
	}

	// Verify the Turnstile token unless verification is disabled (no secret set,
	// e.g. local dev). Done before the coverage DB query so bots can't drive it.
	if h.turnstileSecret != "" {
		if reason := h.verifyTurnstile(r.Context(), req.TurnstileToken); reason != "" {
			failSubscribe(w, r, "captcha_failed", http.StatusForbidden,
				"captcha verification failed",
				fmt.Sprintf("email=%s turnstile=%s", maskEmail(req.Email), reason))
			return
		}
	}

	// Reject signups outside our coverage area: with no upcoming event within
	// the subscriber's radius, the weekly digest would always be empty. This
	// mirrors the client-side coverage filter and is the authoritative gate.
	nearby, err := h.queries.CountUpcomingEventsWithinRadius(r.Context(), store.CountUpcomingEventsWithinRadiusParams{
		Lng:          req.Longitude,
		Lat:          req.Latitude,
		RadiusMeters: float64(radius) * 1609.34,
	})
	if err != nil {
		failSubscribe(w, r, "coverage_db_error", http.StatusInternalServerError, "failed to subscribe",
			fmt.Sprintf("email=%s err=%v", maskEmail(req.Email), err))
		return
	}
	if nearby == 0 {
		failSubscribe(w, r, "out_of_area", http.StatusUnprocessableEntity, "we don't cover that area yet",
			fmt.Sprintf("email=%s lat=%f lng=%f radius=%d", maskEmail(req.Email), req.Latitude, req.Longitude, radius))
		return
	}

	sub, err := h.queries.UpsertEmailSubscriber(r.Context(), store.UpsertEmailSubscriberParams{
		Email:       req.Email,
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		RadiusMiles: radius,
	})
	if err != nil {
		failSubscribe(w, r, "upsert_db_error", http.StatusInternalServerError, "failed to subscribe",
			fmt.Sprintf("email=%s err=%v", maskEmail(req.Email), err))
		return
	}

	// Already confirmed: this was just a location refresh, nothing to send.
	// Otherwise (re)send the confirmation email.
	if !sub.Confirmed {
		metrics.DigestSubscribeTotal.WithLabelValues("confirmation_sent").Inc()
		h.sendConfirmationEmail(sub.Email, uuidString(sub.ConfirmToken))
	} else {
		metrics.DigestSubscribeTotal.WithLabelValues("already_confirmed").Inc()
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
	confirmURL := fmt.Sprintf("%s/api/subscribe/confirm/%s", h.apiURL, confirmToken)
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

// verifyTurnstile validates the client token against Cloudflare's siteverify
// API. It returns "" when the token is valid, otherwise a short machine-readable
// reason. The reason matters: siteverify distinguishes a token the visitor
// already spent or let expire (timeout-or-duplicate) from a misconfigured
// deployment (invalid-input-secret) — identical 403s to the client, but the
// first is one user's problem and the second means signup is down for everyone.
func (h *SubscribeHandler) verifyTurnstile(ctx context.Context, token string) string {
	record := func(reason string) string {
		metrics.TurnstileVerifyTotal.WithLabelValues(reason).Inc()
		return reason
	}

	if token == "" {
		return record("missing-input-response")
	}

	form := url.Values{}
	form.Set("secret", h.turnstileSecret)
	form.Set("response", token)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://challenges.cloudflare.com/turnstile/v0/siteverify", strings.NewReader(form.Encode()))
	if err != nil {
		log.Printf("Subscribe: turnstile request build failed: %v", err)
		return record("request-build-failed")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		log.Printf("Subscribe: turnstile verify request failed: %v", err)
		return record("siteverify-unreachable")
	}
	defer resp.Body.Close()

	var out struct {
		Success    bool     `json:"success"`
		ErrorCodes []string `json:"error-codes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		log.Printf("Subscribe: turnstile response decode failed (http %d): %v", resp.StatusCode, err)
		return record("siteverify-decode-failed")
	}
	if out.Success {
		metrics.TurnstileVerifyTotal.WithLabelValues("success").Inc()
		return ""
	}
	if len(out.ErrorCodes) == 0 {
		return record("unknown")
	}
	// Label on the first code only — the set is small and fixed, so cardinality
	// stays bounded; the full set goes to the caller's log line.
	metrics.TurnstileVerifyTotal.WithLabelValues(out.ErrorCodes[0]).Inc()
	return strings.Join(out.ErrorCodes, ",")
}

// maskEmail keeps an address correlatable in logs without writing it in the
// clear: "someone@example.com" becomes "s*****e@example.com".
func maskEmail(email string) string {
	at := strings.LastIndex(email, "@")
	if at <= 0 {
		return "(invalid)"
	}
	local, domain := email[:at], email[at+1:]
	if len(local) <= 2 {
		return strings.Repeat("*", len(local)) + "@" + domain
	}
	return string(local[0]) + strings.Repeat("*", len(local)-2) + string(local[len(local)-1]) + "@" + domain
}

// clientIPForLog returns the caller's IP as normalized by chi's RealIP
// middleware, for correlating repeated failures from the same visitor.
func clientIPForLog(r *http.Request) string {
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
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
