package notifier

import (
	"fmt"
	"html"
	"log"
	"strings"
)

// AdminAlerter sends transactional emails to site administrators when users
// take actions that need review (new suggestions, author applications, and
// event submissions). It is safe to use as a nil pointer — every method is a
// no-op when the alerter, its email sender, or its recipient list is unset, so
// handlers can hold an *AdminAlerter unconditionally.
type AdminAlerter struct {
	email       *EmailSender
	recipients  []string
	frontendURL string
}

// NewAdminAlerter builds an alerter from a comma-separated list of recipient
// addresses. Returns nil if no email sender or no recipients are configured,
// which keeps the no-op nil-receiver behavior intact.
func NewAdminAlerter(email *EmailSender, recipientList, frontendURL string) *AdminAlerter {
	if email == nil {
		return nil
	}
	var recipients []string
	for _, addr := range strings.Split(recipientList, ",") {
		if addr = strings.TrimSpace(addr); addr != "" {
			recipients = append(recipients, addr)
		}
	}
	if len(recipients) == 0 {
		return nil
	}
	return &AdminAlerter{email: email, recipients: recipients, frontendURL: frontendURL}
}

// send dispatches to every recipient on a background goroutine so the alert
// never blocks (or fails) the user request that triggered it. Errors are
// logged, not surfaced.
func (a *AdminAlerter) send(subject, body string) {
	if a == nil || a.email == nil || len(a.recipients) == 0 {
		return
	}
	htmlBody := a.wrap(body)
	for _, to := range a.recipients {
		to := to
		go func() {
			if err := a.email.Send(to, subject, htmlBody); err != nil {
				log.Printf("admin alert: failed to send %q to %s: %v", subject, to, err)
			}
		}()
	}
}

// wrap appends a link to the admin area below the message body.
func (a *AdminAlerter) wrap(body string) string {
	if a.frontendURL == "" {
		return body
	}
	adminURL := strings.TrimRight(a.frontendURL, "/") + "/admin"
	return fmt.Sprintf(
		`%s<p style="margin-top:24px"><a href="%s">Open the admin dashboard &rarr;</a></p>`,
		body, html.EscapeString(adminURL),
	)
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func row(label, value string) string {
	if value == "" {
		value = "—"
	}
	return fmt.Sprintf(
		`<p style="margin:4px 0"><strong>%s:</strong> %s</p>`,
		html.EscapeString(label), html.EscapeString(value),
	)
}

// NewAuthorApplication alerts admins that a user has applied to become an author.
func (a *AdminAlerter) NewAuthorApplication(fullName, email, bio, experience string) {
	subject := "New Author Application: " + fullName
	body := "<h2>New Author Application</h2>" +
		row("Name", fullName) +
		row("Email", email) +
		row("Bio", bio) +
		row("Experience", experience)
	a.send(subject, body)
}

// NewSuggestion alerts admins that a user has submitted an edit, create, or
// delete suggestion to the review queue. submitter is the signed-in user's
// email, or empty for anonymous submissions.
func (a *AdminAlerter) NewSuggestion(targetType, action, name, reason, submitter string) {
	title := capitalize(action) + " " + targetType
	if name != "" {
		title += ": " + name
	}
	if submitter == "" {
		submitter = "anonymous"
	}
	subject := "New Suggestion — " + title
	body := "<h2>New Suggestion</h2>" +
		row("Type", targetType) +
		row("Action", action) +
		row("Target", name) +
		row("Submitted by", submitter) +
		row("Reason", reason)
	a.send(subject, body)
}

// NewEventSubmission alerts admins that an author/admin has published a new event.
func (a *AdminAlerter) NewEventSubmission(title, location, submitter string) {
	subject := "New Event Submitted: " + title
	body := "<h2>New Event Submitted</h2>" +
		row("Title", title) +
		row("Location", location) +
		row("Submitted by", submitter)
	a.send(subject, body)
}
