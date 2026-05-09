// Package embedding wraps the OpenAI text-embedding-3-small API and exposes
// helpers for building event input strings.
package embedding

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	Model      = "text-embedding-3-small"
	Dimensions = 1536
	endpoint   = "https://api.openai.com/v1/embeddings"
	// MaxBatch is the per-request input cap. OpenAI accepts up to 2048,
	// but smaller batches keep failure blast-radius small and stay well
	// under the 8192-token-per-input limit when descriptions are long.
	MaxBatch = 100
)

// Client calls the OpenAI embeddings API.
type Client struct {
	APIKey string
	HTTP   *http.Client
}

func NewClient(apiKey string) *Client {
	return &Client{
		APIKey: apiKey,
		HTTP:   &http.Client{Timeout: 60 * time.Second},
	}
}

type embedRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

type embedResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}

// Embed returns one vector per input, in the same order. Caller must keep
// each batch under MaxBatch.
func (c *Client) Embed(ctx context.Context, inputs []string) ([][]float32, error) {
	if len(inputs) == 0 {
		return nil, nil
	}
	if len(inputs) > MaxBatch {
		return nil, fmt.Errorf("batch size %d exceeds max %d", len(inputs), MaxBatch)
	}

	body, err := json.Marshal(embedRequest{Model: Model, Input: inputs})
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openai status %d: %s", resp.StatusCode, string(respBody))
	}

	var parsed embedResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if parsed.Error != nil {
		return nil, fmt.Errorf("openai error: %s", parsed.Error.Message)
	}
	if len(parsed.Data) != len(inputs) {
		return nil, fmt.Errorf("expected %d embeddings, got %d", len(inputs), len(parsed.Data))
	}

	out := make([][]float32, len(inputs))
	for _, d := range parsed.Data {
		if d.Index < 0 || d.Index >= len(inputs) {
			return nil, fmt.Errorf("openai returned out-of-range index %d", d.Index)
		}
		out[d.Index] = d.Embedding
	}
	return out, nil
}

// EventInput is the canonical text representation of an event for embedding.
// Keep this stable — changing it invalidates every existing vector.
type EventInput struct {
	Title       string
	Description string
	Categories  []string
	VenueName   string
	City        string
}

// String renders the embedding input. Description is truncated to keep
// token usage bounded and to avoid one rambling event dominating the vector.
func (e EventInput) String() string {
	desc := e.Description
	if len(desc) > 1500 {
		desc = desc[:1500]
	}
	var b strings.Builder
	b.WriteString(e.Title)
	if desc != "" {
		b.WriteString("\n")
		b.WriteString(desc)
	}
	if len(e.Categories) > 0 {
		b.WriteString("\nCategories: ")
		b.WriteString(strings.Join(e.Categories, ", "))
	}
	if e.VenueName != "" {
		b.WriteString("\nVenue: ")
		b.WriteString(e.VenueName)
		if e.City != "" {
			b.WriteString(", ")
			b.WriteString(e.City)
		}
	}
	return b.String()
}
