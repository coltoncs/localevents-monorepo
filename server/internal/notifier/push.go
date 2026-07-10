package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/metrics"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

const (
	expoPushURL = "https://exp.host/--/api/v2/push/send"
	// Expo accepts at most 100 messages per request.
	expoPushBatchSize = 100
)

// ExpoPushClient sends mobile push notifications through Expo's push service.
// No credentials are needed; Expo relays to APNs/FCM on our behalf.
type ExpoPushClient struct {
	queries *store.Queries
	client  *http.Client
}

func NewExpoPushClient(q *store.Queries) *ExpoPushClient {
	return &ExpoPushClient{
		queries: q,
		client:  metrics.NewInstrumentedClient("expo_push", 30*time.Second),
	}
}

// ExpoPushMessage is a single notification addressed to one Expo push token
// (e.g. "ExponentPushToken[xxx]").
type ExpoPushMessage struct {
	To    string         `json:"to"`
	Title string         `json:"title"`
	Body  string         `json:"body"`
	Data  map[string]any `json:"data,omitempty"`
}

// expoPushTicket is one entry of the "data" array in Expo's response. Tickets
// are index-aligned with the messages in the request.
type expoPushTicket struct {
	Status  string `json:"status"` // "ok" or "error"
	ID      string `json:"id,omitempty"`
	Message string `json:"message,omitempty"`
	Details struct {
		Error string `json:"error,omitempty"`
	} `json:"details,omitempty"`
}

type expoPushResponse struct {
	Data []expoPushTicket `json:"data"`
}

// Send delivers messages in batches of at most 100. Tokens Expo reports as
// DeviceNotRegistered are pruned from device_tokens so we stop pushing to
// dead installs. Individual ticket errors are logged, not returned; the
// returned error covers transport/HTTP failures only.
func (c *ExpoPushClient) Send(ctx context.Context, messages []ExpoPushMessage) error {
	for start := 0; start < len(messages); start += expoPushBatchSize {
		end := min(start+expoPushBatchSize, len(messages))
		if err := c.sendBatch(ctx, messages[start:end]); err != nil {
			return err
		}
	}
	return nil
}

func (c *ExpoPushClient) sendBatch(ctx context.Context, batch []ExpoPushMessage) error {
	body, err := json.Marshal(batch)
	if err != nil {
		return fmt.Errorf("marshal push payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", expoPushURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create push request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("send push: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var errBody bytes.Buffer
		errBody.ReadFrom(resp.Body)
		return fmt.Errorf("expo push API error (%d): %s", resp.StatusCode, errBody.String())
	}

	var parsed expoPushResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return fmt.Errorf("decode push response: %w", err)
	}

	// Tickets come back in the same order as the messages sent.
	for i, ticket := range parsed.Data {
		if ticket.Status != "error" || i >= len(batch) {
			continue
		}
		token := batch[i].To
		log.Printf("Push: ticket error for token %s: %s (%s)", token, ticket.Message, ticket.Details.Error)
		if ticket.Details.Error == "DeviceNotRegistered" {
			if err := c.queries.DeleteDeviceTokenByToken(ctx, token); err != nil {
				log.Printf("Push: failed to prune dead token %s: %v", token, err)
			}
		}
	}

	return nil
}
