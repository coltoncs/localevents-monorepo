package notifier

import (
	"bytes"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/metrics"
)

type SMSSender struct {
	accountSID string
	authToken  string
	fromNumber string
	client     *http.Client
}

func NewSMSSender(accountSID, authToken, fromNumber string) *SMSSender {
	return &SMSSender{
		accountSID: accountSID,
		authToken:  authToken,
		fromNumber: fromNumber,
		client:     metrics.NewInstrumentedClient("twilio", 30*time.Second),
	}
}

func (s *SMSSender) Send(to, body string) error {
	endpoint := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", s.accountSID)

	form := url.Values{}
	form.Set("To", to)
	form.Set("From", s.fromNumber)
	form.Set("Body", body)

	req, err := http.NewRequest("POST", endpoint, bytes.NewBufferString(form.Encode()))
	if err != nil {
		return fmt.Errorf("create sms request: %w", err)
	}
	req.SetBasicAuth(s.accountSID, s.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("send sms: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var errBody bytes.Buffer
		errBody.ReadFrom(resp.Body)
		return fmt.Errorf("twilio API error (%d): %s", resp.StatusCode, errBody.String())
	}

	return nil
}
