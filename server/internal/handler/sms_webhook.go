package handler

import (
	"log"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/store"
)

type SMSWebhookHandler struct {
	queries *store.Queries
}

func NewSMSWebhookHandler(q *store.Queries) *SMSWebhookHandler {
	return &SMSWebhookHandler{queries: q}
}

// Incoming handles Twilio's inbound SMS webhook.
// Twilio sends a POST with form-encoded fields including "From" and "Body".
// We handle STOP (opt-out) and START/UNSTOP (opt-back-in).
func (h *SMSWebhookHandler) Incoming(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	from := r.FormValue("From")
	body := strings.TrimSpace(strings.ToUpper(r.FormValue("Body")))

	if from == "" {
		http.Error(w, "missing From", http.StatusBadRequest)
		return
	}

	phone := pgtype.Text{String: from, Valid: true}

	switch body {
	case "STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT":
		err := h.queries.UnsubscribeSMSByPhoneNumber(r.Context(), phone)
		if err != nil {
			log.Printf("SMS webhook: failed to unsubscribe %s: %v", from, err)
		} else {
			log.Printf("SMS webhook: unsubscribed %s", from)
		}
	case "START", "UNSTOP":
		err := h.queries.ResubscribeSMSByPhoneNumber(r.Context(), phone)
		if err != nil {
			log.Printf("SMS webhook: failed to resubscribe %s: %v", from, err)
		} else {
			log.Printf("SMS webhook: resubscribed %s", from)
		}
	default:
		log.Printf("SMS webhook: unhandled message from %s: %q", from, body)
	}

	// Respond with empty TwiML to acknowledge without sending a reply
	w.Header().Set("Content-Type", "text/xml")
	w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`))
}
