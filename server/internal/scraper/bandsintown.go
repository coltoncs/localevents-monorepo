package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Bandsintown implements EventSource using the Bandsintown Events Search API.
type Bandsintown struct {
	AppID  string
	Client *http.Client
}

// NewBandsintown creates a new Bandsintown source with the given app ID.
func NewBandsintown(appID string) *Bandsintown {
	return &Bandsintown{
		AppID:  appID,
		Client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (b *Bandsintown) Name() string { return "bandsintown" }

func (b *Bandsintown) FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error) {
	radiusMiles := int(float64(loc.RadiusKM) * 0.621371)

	now := time.Now().UTC()
	dateStart := now.Format("2006-01-02")
	dateEnd := now.AddDate(0, 6, 0).Format("2006-01-02")

	url := fmt.Sprintf(
		"https://rest.bandsintown.com/events/search?app_id=%s&location=%f,%f&radius=%d&date=%s,%s",
		b.AppID, loc.Latitude, loc.Longitude, radiusMiles, dateStart, dateEnd,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	resp, err := b.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching events: %w", err)
	}

	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var bitEvents []bitEvent
	if err := json.Unmarshal(body, &bitEvents); err != nil {
		return nil, fmt.Errorf("parsing response: %w", err)
	}

	var allEvents []RawEvent
	for _, ev := range bitEvents {
		raw, err := mapBITEvent(ev)
		if err != nil {
			continue
		}
		allEvents = append(allEvents, raw)
	}

	return allEvents, nil
}

func mapBITEvent(ev bitEvent) (RawEvent, error) {
	if ev.Datetime == "" {
		return RawEvent{}, fmt.Errorf("no start time for event %s", ev.ID)
	}

	t, err := time.Parse(time.RFC3339, ev.Datetime)
	if err != nil {
		// Try without timezone
		t, err = time.Parse("2006-01-02T15:04:05", ev.Datetime)
		if err != nil {
			return RawEvent{}, fmt.Errorf("parsing start time: %w", err)
		}
	}

	title := ev.Title
	if title == "" && len(ev.Lineup) > 0 {
		title = strings.Join(ev.Lineup, ", ")
	}

	ticketURL := ev.URL
	if len(ev.Offers) > 0 && ev.Offers[0].URL != "" {
		ticketURL = ev.Offers[0].URL
	}

	raw := RawEvent{
		ExternalID: ev.ID,
		Source:     "bandsintown",
		Title:      title,
		StartTime:  t.UTC(),
		Category:   "Music",
		ImageURL:   ev.ImageURL,
		TicketURL:  ticketURL,
		VenueName:  ev.Venue.Name,
		City:       ev.Venue.City,
		State:      ev.Venue.Region,
		Latitude:   ev.Venue.Latitude,
		Longitude:  ev.Venue.Longitude,
	}

	return raw, nil
}

// Bandsintown API response types

type bitEvent struct {
	ID       string      `json:"id"`
	Title    string      `json:"title"`
	Datetime string      `json:"datetime"`
	URL      string      `json:"url"`
	ImageURL string      `json:"image_url"`
	Venue    bitVenue    `json:"venue"`
	Offers   []bitOffer  `json:"offers"`
	Lineup   []string    `json:"lineup"`
}

type bitVenue struct {
	Name      string  `json:"name"`
	City      string  `json:"city"`
	Region    string  `json:"region"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type bitOffer struct {
	URL string `json:"url"`
}
