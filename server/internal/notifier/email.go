package notifier

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/metrics"
)

type EmailSender struct {
	apiKey string
	from   string
	client *http.Client
}

func NewEmailSender(apiKey, from string) *EmailSender {
	return &EmailSender{
		apiKey: apiKey,
		from:   from,
		client: metrics.NewInstrumentedClient("resend", 30*time.Second),
	}
}

type resendPayload struct {
	From    string `json:"from"`
	To      []string `json:"to"`
	Subject string `json:"subject"`
	HTML    string `json:"html"`
}

func (s *EmailSender) Send(to, subject, html string) error {
	payload := resendPayload{
		From:    s.from,
		To:      []string{to},
		Subject: subject,
		HTML:    html,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal email payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create email request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var errBody bytes.Buffer
		errBody.ReadFrom(resp.Body)
		return fmt.Errorf("resend API error (%d): %s", resp.StatusCode, errBody.String())
	}

	return nil
}
