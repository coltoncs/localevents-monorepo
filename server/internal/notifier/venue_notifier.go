package notifier

import (
	"fmt"
	"html"
	"strings"
)

// VenueNotifier sends booking-request emails from artists to a venue's booking
// contact. Unlike AdminAlerter (which fans out to a fixed admin list), this
// emails an arbitrary venue-supplied address. Safe to use as a nil pointer:
// SendBookingRequest is a no-op and reports false when the notifier or its
// email sender is unset, so handlers can detect "email not configured".
type VenueNotifier struct {
	email       *EmailSender
	frontendURL string
}

// NewVenueNotifier returns nil when no email sender is configured, preserving
// the no-op nil-receiver behavior.
func NewVenueNotifier(email *EmailSender, frontendURL string) *VenueNotifier {
	if email == nil {
		return nil
	}
	return &VenueNotifier{email: email, frontendURL: frontendURL}
}

// Enabled reports whether booking emails can actually be sent.
func (n *VenueNotifier) Enabled() bool {
	return n != nil && n.email != nil
}

// SendBookingRequest emails a venue's booking contact with an artist's booking
// inquiry. Returns an error if sending fails; callers surface that to the
// requester. The artist's email is set as Reply-To-style content in the body
// (EmailSender has no reply-to field), so the venue can respond directly.
func (n *VenueNotifier) SendBookingRequest(toEmail, venueName, fromName, fromEmail, message string) error {
	if !n.Enabled() {
		return fmt.Errorf("venue notifier not configured")
	}
	subject := fmt.Sprintf("Booking request for %s — %s", venueName, fromName)
	body := "<h2>New Booking Request</h2>" +
		bookingRow("Venue", venueName) +
		bookingRow("From", fromName) +
		bookingRow("Reply to", fromEmail) +
		bookingRow("Message", message)
	if n.frontendURL != "" {
		body += fmt.Sprintf(
			`<p style="margin-top:24px;color:#666;font-size:13px">Sent via %s</p>`,
			html.EscapeString(strings.TrimRight(n.frontendURL, "/")),
		)
	}
	return n.email.Send(toEmail, subject, body)
}

func bookingRow(label, value string) string {
	if value == "" {
		value = "—"
	}
	return fmt.Sprintf(
		`<p style="margin:4px 0"><strong>%s:</strong> %s</p>`,
		html.EscapeString(label), html.EscapeString(value),
	)
}
