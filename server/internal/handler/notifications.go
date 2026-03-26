package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/billing"
	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/notifier"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type NotificationHandler struct {
	queries        *store.Queries
	frontendURL    string
	clerkSecretKey string
	digestRunner   *notifier.Runner
}

func NewNotificationHandler(q *store.Queries, frontendURL, clerkSecretKey string, digestRunner *notifier.Runner) *NotificationHandler {
	return &NotificationHandler{queries: q, frontendURL: frontendURL, clerkSecretKey: clerkSecretKey, digestRunner: digestRunner}
}

type notificationPrefsResponse struct {
	EmailEnabled        bool     `json:"email_enabled"`
	SMSEnabled          bool     `json:"sms_enabled"`
	PhoneNumber         string   `json:"phone_number,omitempty"`
	HasSubscription     bool     `json:"has_subscription"`
	PreferredCategories []string `json:"preferred_categories"`
}

func (h *NotificationHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
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

	hasSubscription, _ := billing.HasActiveSubscription(h.clerkSecretKey, clerkID)

	prefs, err := h.queries.GetNotificationPreferences(r.Context(), user.ID)
	if err != nil {
		// No preferences yet, return defaults
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(notificationPrefsResponse{HasSubscription: hasSubscription})
		return
	}

	resp := notificationPrefsResponse{
		EmailEnabled:        prefs.EmailEnabled,
		SMSEnabled:          prefs.SmsEnabled,
		HasSubscription:     hasSubscription,
		PreferredCategories: prefs.PreferredCategories,
	}
	if user.PhoneNumber.Valid {
		resp.PhoneNumber = user.PhoneNumber.String
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

type updateNotificationRequest struct {
	EmailEnabled        bool     `json:"email_enabled"`
	SMSEnabled          bool     `json:"sms_enabled"`
	PhoneNumber         string   `json:"phone_number,omitempty"`
	PreferredCategories []string `json:"preferred_categories"`
}

var e164Regex = regexp.MustCompile(`^\+1\d{10}$`)

func (h *NotificationHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req updateNotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	// Validation
	if req.EmailEnabled && !user.Email.Valid {
		http.Error(w, `{"error":"email required to enable email notifications"}`, http.StatusBadRequest)
		return
	}
	if req.SMSEnabled {
		// SMS requires active subscription
		active, err := billing.HasActiveSubscription(h.clerkSecretKey, clerkID)
		if err != nil {
			http.Error(w, `{"error":"failed to verify subscription status"}`, http.StatusInternalServerError)
			return
		}
		if !active {
			http.Error(w, `{"error":"active subscription required for SMS notifications"}`, http.StatusForbidden)
			return
		}
		if req.PhoneNumber == "" && !user.PhoneNumber.Valid {
			http.Error(w, `{"error":"phone number required to enable SMS notifications"}`, http.StatusBadRequest)
			return
		}
		if req.PhoneNumber != "" && !e164Regex.MatchString(req.PhoneNumber) {
			http.Error(w, `{"error":"phone number must be in E.164 format (+1XXXXXXXXXX)"}`, http.StatusBadRequest)
			return
		}
	}
	if (req.EmailEnabled || req.SMSEnabled) && !user.DefaultLatitude.Valid {
		http.Error(w, `{"error":"default location required to enable notifications"}`, http.StatusBadRequest)
		return
	}
	if len(req.PreferredCategories) > 3 {
		http.Error(w, `{"error":"maximum 3 preferred categories allowed"}`, http.StatusBadRequest)
		return
	}

	// Update phone number if provided
	if req.PhoneNumber != "" {
		if err := h.queries.UpdateUserPhoneNumber(r.Context(), store.UpdateUserPhoneNumberParams{
			ID:          user.ID,
			PhoneNumber: pgtype.Text{String: req.PhoneNumber, Valid: true},
		}); err != nil {
			http.Error(w, `{"error":"failed to update phone number"}`, http.StatusInternalServerError)
			return
		}
	}

	// Upsert notification preferences
	prefs, err := h.queries.UpsertNotificationPreferences(r.Context(), store.UpsertNotificationPreferencesParams{
		UserID:              user.ID,
		EmailEnabled:        req.EmailEnabled,
		SmsEnabled:          req.SMSEnabled,
		PreferredCategories: req.PreferredCategories,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to update notification preferences"}`, http.StatusInternalServerError)
		return
	}

	hasSubscription, _ := billing.HasActiveSubscription(h.clerkSecretKey, clerkID)
	resp := notificationPrefsResponse{
		EmailEnabled:        prefs.EmailEnabled,
		SMSEnabled:          prefs.SmsEnabled,
		PreferredCategories: prefs.PreferredCategories,
		HasSubscription:     hasSubscription,
	}
	if req.PhoneNumber != "" {
		resp.PhoneNumber = req.PhoneNumber
	} else if user.PhoneNumber.Valid {
		resp.PhoneNumber = user.PhoneNumber.String
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *NotificationHandler) TriggerDigest(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	active, err := billing.HasActiveSubscription(h.clerkSecretKey, clerkID)
	if err != nil || !active {
		http.Error(w, `{"error":"active subscription required"}`, http.StatusForbidden)
		return
	}

	if h.digestRunner == nil {
		http.Error(w, `{"error":"digest not configured"}`, http.StatusServiceUnavailable)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	if err := h.digestRunner.RunForUser(r.Context(), user.ID); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusUnprocessableEntity)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "digest sent"})
}

func (h *NotificationHandler) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	tokenStr := chi.URLParam(r, "token")
	token, err := uuid.Parse(tokenStr)
	if err != nil {
		http.Error(w, "Invalid unsubscribe link", http.StatusBadRequest)
		return
	}

	pgToken := pgtype.UUID{Bytes: token, Valid: true}

	// Try email token first, then SMS
	err = h.queries.UnsubscribeByEmailToken(r.Context(), pgToken)
	if err != nil {
		err = h.queries.UnsubscribeBySMSToken(r.Context(), pgToken)
	}

	// Always show success page (don't leak info about valid/invalid tokens)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f4f4;">
<div style="text-align:center;background:#fff;padding:40px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
<h1 style="color:#0d5c63;">Unsubscribed</h1>
<p style="color:#555;">You have been unsubscribed from notifications.</p>
<a href="%s/settings" style="color:#0d5c63;">Manage your settings</a>
</div>
</body>
</html>`, h.frontendURL)
}
