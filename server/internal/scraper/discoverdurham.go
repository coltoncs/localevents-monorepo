package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"
)

const ddBaseURL = "https://www.discoverdurham.com"

// DiscoverDurham implements EventSource for the Discover Durham events site.
// It scrapes server-rendered event listing pages and parses schema.org JSON-LD
// from individual event detail pages.
type DiscoverDurham struct {
	Client *http.Client
}

// NewDiscoverDurham creates a new DiscoverDurham source.
func NewDiscoverDurham() *DiscoverDurham {
	return &DiscoverDurham{
		Client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (d *DiscoverDurham) Name() string { return "discoverdurham" }

// FetchEvents only runs for the Durham location to avoid duplicate work.
func (d *DiscoverDurham) FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error) {
	if loc.Name != "Durham" {
		return nil, nil
	}

	eventURLs, err := d.fetchEventURLs(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetching event URLs: %w", err)
	}

	cutoff := time.Now().AddDate(0, 0, 8) // ~1 week out
	var allEvents []RawEvent
	for _, u := range eventURLs {
		raw, err := d.fetchEventDetail(ctx, u, loc)
		if err != nil {
			continue
		}
		if raw.StartTime.After(cutoff) {
			continue
		}
		allEvents = append(allEvents, raw)
		time.Sleep(200 * time.Millisecond)
	}

	return allEvents, nil
}

var (
	// Matches relative event page hrefs like /events/slug-name/
	eventHrefRe = regexp.MustCompile(`href="(/events/[a-z0-9][^"#]*?/)"`)
	ldJSONRe    = regexp.MustCompile(`(?s)<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>`)
)

// fetchEventURLs paginates through the server-rendered event listing pages
// to collect individual event page URLs.
func (d *DiscoverDurham) fetchEventURLs(ctx context.Context) ([]string, error) {
	seen := make(map[string]bool)
	var urls []string

	for page := 1; page <= 20; page++ {
		target := fmt.Sprintf("%s/events/?page=%d", ddBaseURL, page)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
		if err != nil {
			return nil, err
		}

		resp, err := d.Client.Do(req)
		if err != nil {
			return nil, err
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}

		if resp.StatusCode != http.StatusOK {
			break
		}

		matches := eventHrefRe.FindAllSubmatch(body, -1)
		if len(matches) == 0 {
			break
		}

		newThisPage := 0
		for _, m := range matches {
			u := ddBaseURL + string(m[1])
			if !seen[u] {
				seen[u] = true
				urls = append(urls, u)
				newThisPage++
			}
		}

		if newThisPage == 0 {
			break
		}

		time.Sleep(200 * time.Millisecond)
	}

	return urls, nil
}

// fetchEventDetail GETs an individual event page and extracts its
// schema.org Event JSON-LD block.
func (d *DiscoverDurham) fetchEventDetail(ctx context.Context, eventURL string, loc Location) (RawEvent, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, eventURL, nil)
	if err != nil {
		return RawEvent{}, err
	}
	resp, err := d.Client.Do(req)
	if err != nil {
		return RawEvent{}, err
	}
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return RawEvent{}, err
	}

	for _, m := range ldJSONRe.FindAllSubmatch(body, -1) {
		// The JSON-LD on these pages uses a @graph wrapper containing multiple
		// typed objects; we iterate to find the one with @type == "Event".
		var wrapper struct {
			Type  string            `json:"@type"`
			Graph []json.RawMessage `json:"@graph"`
		}
		if err := json.Unmarshal(m[1], &wrapper); err != nil {
			continue
		}

		candidates := wrapper.Graph
		if len(candidates) == 0 {
			candidates = []json.RawMessage{m[1]}
		}

		for _, candidate := range candidates {
			var typed struct {
				Type string `json:"@type"`
			}
			if err := json.Unmarshal(candidate, &typed); err != nil || typed.Type != "Event" {
				continue
			}
			return mapDDEvent(candidate, eventURL, loc)
		}
	}

	return RawEvent{}, fmt.Errorf("no Event JSON-LD found on %s", eventURL)
}

func mapDDEvent(data json.RawMessage, pageURL string, loc Location) (RawEvent, error) {
	var ev ddEvent
	if err := json.Unmarshal(data, &ev); err != nil {
		return RawEvent{}, err
	}
	if ev.StartDate == "" {
		return RawEvent{}, fmt.Errorf("missing startDate")
	}

	startTime, err := time.Parse(time.RFC3339, ev.StartDate)
	if err != nil {
		startTime, err = time.Parse("2006-01-02T15:04", ev.StartDate)
		if err != nil {
			return RawEvent{}, fmt.Errorf("parsing startDate %q: %w", ev.StartDate, err)
		}
	}

	raw := RawEvent{
		ExternalID:  pageURL,
		Source:      "discoverdurham",
		Title:       ev.Name,
		Description: ev.Description,
		StartTime:   startTime.UTC(),
		TicketURL:   ev.URL,
		// Fall back to Durham city centre if the event has no geo data.
		Latitude:  loc.Latitude,
		Longitude: loc.Longitude,
	}

	if ev.EndDate != "" {
		if t, err := time.Parse(time.RFC3339, ev.EndDate); err == nil {
			raw.EndTime = &t
		}
	}

	raw.VenueName = ev.Location.Name
	raw.Address = ev.Location.Address.StreetAddress
	raw.City = ev.Location.Address.Locality
	raw.State = ev.Location.Address.Region
	raw.Zip = ev.Location.Address.PostalCode

	if ev.Location.Geo.Latitude != 0 {
		raw.Latitude = ev.Location.Geo.Latitude
		raw.Longitude = ev.Location.Geo.Longitude
	}

	raw.ImageURL = ddImageURL(ev.Image)

	return raw, nil
}

// ddImageURL extracts the image URL from the JSON-LD image field,
// which can be either a plain string or an ImageObject {"url":"..."}.
func ddImageURL(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	// Try as a plain string first.
	var s string
	if json.Unmarshal(raw, &s) == nil && s != "" {
		return s
	}
	// Try as an ImageObject.
	var obj struct {
		URL string `json:"url"`
	}
	if json.Unmarshal(raw, &obj) == nil {
		return obj.URL
	}
	return ""
}

// schema.org JSON-LD types used by Discover Durham event pages.

type ddEvent struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	StartDate   string          `json:"startDate"`
	EndDate     string          `json:"endDate"`
	URL         string          `json:"url"`
	Image       json.RawMessage `json:"image"`
	Location    ddPlace         `json:"location"`
}

type ddPlace struct {
	Name    string    `json:"name"`
	Geo     ddGeo     `json:"geo"`
	Address ddAddress `json:"address"`
}

type ddAddress struct {
	StreetAddress string `json:"streetAddress"`
	Locality      string `json:"addressLocality"`
	Region        string `json:"addressRegion"`
	PostalCode    string `json:"postalCode"`
}

type ddGeo struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}
