package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/social"
)

type SocialHandler struct {
	generator *social.Generator
}

func NewSocialHandler(generator *social.Generator) *SocialHandler {
	return &SocialHandler{generator: generator}
}

// maxRangeDays caps an on-demand window so cards don't overflow the layout.
const maxRangeDays = 14

// Trigger runs social-card generation on demand (admin only), inferring the
// week vs weekend window from the current weekday.
func (h *SocialHandler) Trigger(w http.ResponseWriter, r *http.Request) {
	if h.generator == nil {
		http.Error(w, `{"error":"social generator not configured"}`, http.StatusServiceUnavailable)
		return
	}

	go h.generator.Run(context.Background())

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "social generation triggered"})
}

// Cities returns the configured social-card cities for the admin UI.
func (h *SocialHandler) Cities(w http.ResponseWriter, r *http.Request) {
	if h.generator == nil {
		http.Error(w, `{"error":"social generator not configured"}`, http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]string{"cities": h.generator.CityNames()})
}

type generateRangeRequest struct {
	Start   string   `json:"start"`   // YYYY-MM-DD (inclusive)
	End     string   `json:"end"`     // YYYY-MM-DD (inclusive)
	Cities  []string `json:"cities"`  // empty = all configured
	Heading string   `json:"heading"` // optional
	Email   string   `json:"email"`   // optional; defaults to admin alert email
}

// GenerateRange renders cards for a custom date range on demand and emails the
// gallery, returning the generated cards (admin only). Synchronous.
func (h *SocialHandler) GenerateRange(w http.ResponseWriter, r *http.Request) {
	if h.generator == nil {
		http.Error(w, `{"error":"social generator not configured"}`, http.StatusServiceUnavailable)
		return
	}

	var req generateRangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	loc, _ := time.LoadLocation("America/New_York")
	start, err := time.ParseInLocation("2006-01-02", req.Start, loc)
	if err != nil {
		http.Error(w, `{"error":"invalid start date (want YYYY-MM-DD)"}`, http.StatusBadRequest)
		return
	}
	endDay, err := time.ParseInLocation("2006-01-02", req.End, loc)
	if err != nil {
		http.Error(w, `{"error":"invalid end date (want YYYY-MM-DD)"}`, http.StatusBadRequest)
		return
	}
	// Treat end as inclusive; the query window is half-open [start, end).
	end := endDay.AddDate(0, 0, 1)
	if !end.After(start) {
		http.Error(w, `{"error":"end date must be on or after start date"}`, http.StatusBadRequest)
		return
	}
	if end.Sub(start) > maxRangeDays*24*time.Hour {
		http.Error(w, `{"error":"date range too large (max 14 days)"}`, http.StatusBadRequest)
		return
	}

	cards, err := h.generator.GenerateRange(r.Context(), social.RangeOptions{
		Start:     start,
		End:       end,
		Heading:   req.Heading,
		Cities:    social.CitiesByName(joinCities(req.Cities)),
		Recipient: req.Email,
	})
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"cards": cards,
		"count": len(cards),
	})
}

// joinCities turns a string slice into the comma-separated form CitiesByName
// expects. An empty slice yields "" so GenerateRange falls back to all cities.
func joinCities(cities []string) string {
	out := ""
	for i, c := range cities {
		if i > 0 {
			out += ","
		}
		out += c
	}
	return out
}
