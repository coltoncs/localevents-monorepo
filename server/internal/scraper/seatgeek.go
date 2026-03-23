package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// SeatGeek implements EventSource using the SeatGeek API v2.
type SeatGeek struct {
	ClientID string
	Client   *http.Client
}

// NewSeatGeek creates a new SeatGeek source with the given client ID.
func NewSeatGeek(clientID string) *SeatGeek {
	return &SeatGeek{
		ClientID: clientID,
		Client:   &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *SeatGeek) Name() string { return "seatgeek" }

func (s *SeatGeek) FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error) {
	var allEvents []RawEvent
	page := 1

	const perPage = 500
	// SeatGeek limits: page * per_page < 5000, so max page is 9 with per_page=500.
	const maxPage = 9

	for {
		url := fmt.Sprintf(
			"https://api.seatgeek.com/2/events?client_id=%s&lat=%f&lon=%f&range=%dkm&per_page=%d&page=%d",
			s.ClientID, loc.Latitude, loc.Longitude, loc.RadiusKM, perPage, page,
		)

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, fmt.Errorf("creating request: %w", err)
		}

		resp, err := s.Client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("fetching page %d: %w", page, err)
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("reading response: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
		}

		var sgResp sgResponse
		if err := json.Unmarshal(body, &sgResp); err != nil {
			return nil, fmt.Errorf("parsing response: %w", err)
		}

		if len(sgResp.Events) == 0 {
			break
		}

		for _, ev := range sgResp.Events {
			raw, err := mapSGEvent(ev)
			if err != nil {
				continue
			}
			allEvents = append(allEvents, raw)
		}

		// Check if we've received all events or hit paging limit
		fetched := page * perPage
		if fetched >= sgResp.Meta.Total || page >= maxPage {
			break
		}
		page++

		time.Sleep(200 * time.Millisecond)
	}

	return allEvents, nil
}

func mapSGEvent(ev sgEvent) (RawEvent, error) {
	if ev.DatetimeUTC == "" {
		return RawEvent{}, fmt.Errorf("no start time for event %d", ev.ID)
	}

	t, err := time.Parse("2006-01-02T15:04:05", ev.DatetimeUTC)
	if err != nil {
		return RawEvent{}, fmt.Errorf("parsing start time: %w", err)
	}

	raw := RawEvent{
		ExternalID: fmt.Sprintf("%d", ev.ID),
		Source:     "seatgeek",
		Title:      ev.Title,
		StartTime:  t.UTC(),
		Categories: []string{ev.Type},
		TicketURL:  ev.URL,
		VenueName:  ev.Venue.Name,
		Address:    ev.Venue.Address,
		City:       ev.Venue.City,
		State:      ev.Venue.State,
		Zip:        ev.Venue.PostalCode,
		Latitude:   ev.Venue.Location.Lat,
		Longitude:  ev.Venue.Location.Lon,
	}

	if len(ev.Performers) > 0 {
		raw.ImageURL = ev.Performers[0].Images.Huge
	}

	if ev.Stats.LowestPrice > 0 {
		min := ev.Stats.LowestPrice
		raw.PriceMin = &min
	}
	if ev.Stats.HighestPrice > 0 {
		max := ev.Stats.HighestPrice
		raw.PriceMax = &max
	}

	return raw, nil
}

// SeatGeek API response types

type sgResponse struct {
	Events []sgEvent `json:"events"`
	Meta   sgMeta    `json:"meta"`
}

type sgMeta struct {
	Total int `json:"total"`
}

type sgEvent struct {
	ID          int            `json:"id"`
	Title       string         `json:"title"`
	Type        string         `json:"type"`
	URL         string         `json:"url"`
	DatetimeUTC string         `json:"datetime_utc"`
	Venue       sgVenue        `json:"venue"`
	Performers  []sgPerformer  `json:"performers"`
	Stats       sgStats        `json:"stats"`
}

type sgVenue struct {
	Name       string      `json:"name"`
	Address    string      `json:"address"`
	City       string      `json:"city"`
	State      string      `json:"state"`
	PostalCode string      `json:"postal_code"`
	Location   sgLocation  `json:"location"`
}

type sgLocation struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type sgPerformer struct {
	Images sgImages `json:"images"`
}

type sgImages struct {
	Huge string `json:"huge"`
}

type sgStats struct {
	LowestPrice  float64 `json:"lowest_price"`
	HighestPrice float64 `json:"highest_price"`
}
