package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/metrics"
)

// Ticketmaster implements EventSource using the Ticketmaster Discovery API v2.
type Ticketmaster struct {
	APIKey string
	Client *http.Client
}

// NewTicketmaster creates a new Ticketmaster source with the given API key.
func NewTicketmaster(apiKey string) *Ticketmaster {
	return &Ticketmaster{
		APIKey: apiKey,
		Client: metrics.NewInstrumentedClient("ticketmaster", 30*time.Second),
	}
}

func (t *Ticketmaster) Name() string { return "ticketmaster" }

func (t *Ticketmaster) FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error) {
	// Small inter-city buffer so back-to-back city fetches don't burst the
	// 5 req/sec Ticketmaster spike-arrest limit.
	time.Sleep(300 * time.Millisecond)

	var allEvents []RawEvent
	page := 0
	startDateTime := time.Now().UTC().Format("2006-01-02T15:04:05Z")

	const pageSize = 200
	// Ticketmaster requires (page * size) < 1000, so max page index is 4 with size=200.
	const maxPage = 4

	for {
		url := fmt.Sprintf(
			"https://app.ticketmaster.com/discovery/v2/events.json?apikey=%s&latlong=%f,%f&radius=%d&unit=km&startDateTime=%s&size=%d&page=%d",
			t.APIKey, loc.Latitude, loc.Longitude, loc.RadiusKM, startDateTime, pageSize, page,
		)

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, fmt.Errorf("creating request: %w", err)
		}

		resp, err := t.Client.Do(req)
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

		var tmResp tmResponse
		if err := json.Unmarshal(body, &tmResp); err != nil {
			return nil, fmt.Errorf("parsing response: %w", err)
		}

		if tmResp.Embedded == nil {
			break
		}

		for _, ev := range tmResp.Embedded.Events {
			if isPlaceholderEvent(ev) {
				continue
			}
			raw, err := mapTMEvent(ev)
			if err != nil {
				continue
			}
			allEvents = append(allEvents, raw)
		}

		// Check if there are more pages or we've hit the API's paging limit
		if tmResp.Page.Number+1 >= tmResp.Page.TotalPages || page >= maxPage {
			break
		}
		page++

		// Rate limit: 300ms between pages (~3 req/sec, safely under the 5 req/sec limit)
		time.Sleep(300 * time.Millisecond)
	}

	return allEvents, nil
}

// Ticketmaster placeholder image that appears on internal/non-public events.
const tmPlaceholderImage = "https://s1.ticketm.net/dam/c/8cf/a6653880-7899-4f67-8067-1f95f4d158cf_124761_TABLET_LANDSCAPE_16_9.jpg"

// isPlaceholderEvent detects internal/administrative Ticketmaster events
// like season ticket renewals, ticket bank holds, and accounting entries.
func isPlaceholderEvent(ev tmEvent) bool {
	// Check for the known placeholder image
	for _, img := range ev.Images {
		if img.URL == tmPlaceholderImage {
			return true
		}
	}

	name := strings.ToLower(ev.Name)

	// Known administrative keywords
	placeholderKeywords := []string{
		"renew",
		"retax",
		"ticket bank",
		"accounting charge",
		"resell move",
		"stm digital",
		"holding event",
		"parking pass",
		"suite rental",
		"deposit",
		"executive vouchers",
		"staff vouchers",
		"stm skate",
		"edunhock",
		"canes cash",
		"shell event",
		"template",
		"gift certificates",
		"president's club guest passes",
	}
	for _, kw := range placeholderKeywords {
		if strings.Contains(name, kw) {
			return true
		}
	}

	// Events with no description, no price, and a "Miscellaneous" or "Undefined"
	// segment are almost always internal placeholder entries.
	if ev.Info == "" && len(ev.PriceRanges) == 0 && len(ev.Classifications) > 0 {
		seg := strings.ToLower(ev.Classifications[0].Segment.Name)
		if seg == "miscellaneous" || seg == "undefined" || seg == "" {
			return true
		}
	}

	return false
}

func mapTMEvent(ev tmEvent) (RawEvent, error) {
	raw := RawEvent{
		ExternalID: ev.ID,
		Source:     "ticketmaster",
		Title:      ev.Name,
	}

	// Description
	if ev.Info != "" {
		raw.Description = ev.Info
	}

	// Dates
	if ev.Dates.Start.DateTime != "" {
		t, err := time.Parse(time.RFC3339, ev.Dates.Start.DateTime)
		if err != nil {
			return RawEvent{}, fmt.Errorf("parsing start time: %w", err)
		}
		raw.StartTime = t
	} else if ev.Dates.Start.LocalDate != "" {
		t, err := time.Parse("2006-01-02", ev.Dates.Start.LocalDate)
		if err != nil {
			return RawEvent{}, fmt.Errorf("parsing local date: %w", err)
		}
		raw.StartTime = t
	} else {
		return RawEvent{}, fmt.Errorf("no start date for event %s", ev.ID)
	}

	if ev.Dates.End.DateTime != "" {
		t, err := time.Parse(time.RFC3339, ev.Dates.End.DateTime)
		if err == nil {
			raw.EndTime = &t
		}
	}

	// Venue
	if len(ev.Embedded.Venues) > 0 {
		v := ev.Embedded.Venues[0]
		raw.VenueName = v.Name
		raw.Address = v.Address.Line1
		raw.City = v.City.Name
		raw.State = v.State.StateCode
		raw.Zip = v.PostalCode

		if v.Location.Latitude != "" && v.Location.Longitude != "" {
			lat, err1 := strconv.ParseFloat(v.Location.Latitude, 64)
			lng, err2 := strconv.ParseFloat(v.Location.Longitude, 64)
			if err1 == nil && err2 == nil {
				raw.Latitude = lat
				raw.Longitude = lng
			}
		}
	}

	// Categories from classifications
	if len(ev.Classifications) > 0 {
		c := ev.Classifications[0]
		if c.Segment.Name != "" && c.Segment.Name != "Undefined" {
			raw.Categories = []string{c.Segment.Name}
		}
	}

	// Image - pick the first with a reasonable ratio
	for _, img := range ev.Images {
		if img.URL != "" {
			raw.ImageURL = img.URL
			break
		}
	}

	// Ticket URL
	raw.TicketURL = ev.URL

	// Price ranges
	if len(ev.PriceRanges) > 0 {
		raw.PriceMin = &ev.PriceRanges[0].Min
		raw.PriceMax = &ev.PriceRanges[0].Max
	}

	return raw, nil
}

// Ticketmaster API response types

type tmResponse struct {
	Embedded *tmEmbeddedEvents `json:"_embedded"`
	Page     tmPage            `json:"page"`
}

type tmEmbeddedEvents struct {
	Events []tmEvent `json:"events"`
}

type tmPage struct {
	Size       int `json:"size"`
	Number     int `json:"number"`
	TotalPages int `json:"totalPages"`
}

type tmEvent struct {
	ID              string             `json:"id"`
	Name            string             `json:"name"`
	URL             string             `json:"url"`
	Info            string             `json:"info"`
	Dates           tmDates            `json:"dates"`
	Classifications []tmClassification `json:"classifications"`
	PriceRanges     []tmPriceRange     `json:"priceRanges"`
	Images          []tmImage          `json:"images"`
	Embedded        tmEventEmbedded    `json:"_embedded"`
}

type tmDates struct {
	Start tmDateTime `json:"start"`
	End   tmDateTime `json:"end"`
}

type tmDateTime struct {
	LocalDate string `json:"localDate"`
	DateTime  string `json:"dateTime"`
}

type tmClassification struct {
	Segment tmNamedItem `json:"segment"`
	Genre   tmNamedItem `json:"genre"`
}

type tmNamedItem struct {
	Name string `json:"name"`
}

type tmPriceRange struct {
	Min float64 `json:"min"`
	Max float64 `json:"max"`
}

type tmImage struct {
	URL   string `json:"url"`
	Width int    `json:"width"`
}

type tmEventEmbedded struct {
	Venues []tmVenue `json:"venues"`
}

type tmVenue struct {
	Name       string      `json:"name"`
	PostalCode string      `json:"postalCode"`
	Address    tmAddress   `json:"address"`
	City       tmNamedItem `json:"city"`
	State      tmState     `json:"state"`
	Location   tmLocation  `json:"location"`
}

type tmAddress struct {
	Line1 string `json:"line1"`
}

type tmState struct {
	StateCode string `json:"stateCode"`
}

type tmLocation struct {
	Latitude  string `json:"latitude"`
	Longitude string `json:"longitude"`
}
