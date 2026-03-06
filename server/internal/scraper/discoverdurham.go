package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const ddBaseURL = "https://www.discoverdurham.com"

// DiscoverDurham implements EventSource for the Discover Durham events site.
// It uses a two-step approach:
//  1. POST to the Craft CMS directory endpoint (with a CSRF token scraped from the
//     listing page) to collect individual event page URLs.
//  2. GET each event page and parse its schema.org Event JSON-LD block.
type DiscoverDurham struct {
	Client *http.Client
}

// NewDiscoverDurham creates a new DiscoverDurham source.
// A cookie jar is required so the CSRF session cookie from step 1 persists
// into the subsequent POST requests.
func NewDiscoverDurham() *DiscoverDurham {
	jar, _ := cookiejar.New(nil)
	return &DiscoverDurham{
		Client: &http.Client{
			Timeout: 30 * time.Second,
			Jar:     jar,
		},
	}
}

func (d *DiscoverDurham) Name() string { return "discoverdurham" }

// FetchEvents only runs for the Durham location to avoid duplicate work.
func (d *DiscoverDurham) FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error) {
	if loc.Name != "Durham" {
		return nil, nil
	}

	csrfName, csrfValue, err := d.fetchCSRFToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetching CSRF token: %w", err)
	}

	eventURLs, err := d.fetchEventURLs(ctx, csrfName, csrfValue)
	if err != nil {
		return nil, fmt.Errorf("fetching event URLs: %w", err)
	}

	var allEvents []RawEvent
	for _, u := range eventURLs {
		raw, err := d.fetchEventDetail(ctx, u, loc)
		if err != nil {
			continue
		}
		allEvents = append(allEvents, raw)
		time.Sleep(200 * time.Millisecond)
	}

	return allEvents, nil
}

var (
	csrfNameRe  = regexp.MustCompile(`window\.csrfTokenName\s*=\s*"([^"]+)"`)
	csrfValueRe = regexp.MustCompile(`window\.csrfTokenValue\s*=\s*"([^"]+)"`)
	// Matches relative event page hrefs like /events/slug-name/
	eventHrefRe = regexp.MustCompile(`href="(/events/[a-z0-9][^"#]*?/)"`)
	ldJSONRe    = regexp.MustCompile(`(?s)<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>`)
)

// fetchCSRFToken GETs the events listing page to obtain the CSRF token name and
// value that Craft CMS embeds as window.csrfToken* JS variables. The resulting
// session cookie is automatically stored in d.Client.Jar.
func (d *DiscoverDurham) fetchCSRFToken(ctx context.Context) (name, value string, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ddBaseURL+"/events/", nil)
	if err != nil {
		return "", "", err
	}
	resp, err := d.Client.Do(req)
	if err != nil {
		return "", "", err
	}
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return "", "", err
	}

	nameMatch := csrfNameRe.FindSubmatch(body)
	valueMatch := csrfValueRe.FindSubmatch(body)
	if nameMatch == nil || valueMatch == nil {
		return "", "", fmt.Errorf("CSRF token not found in page HTML")
	}
	return string(nameMatch[1]), string(valueMatch[1]), nil
}

// fetchEventURLs pages through the directory POST endpoint to collect all
// individual event page URLs within the next 30 days.
func (d *DiscoverDurham) fetchEventURLs(ctx context.Context, csrfName, csrfValue string) ([]string, error) {
	now := time.Now()
	dateFrom := now.Format("2006-01-02")
	dateTo := now.Add(30 * 24 * time.Hour).Format("2006-01-02")

	seen := make(map[string]bool)
	var urls []string

	for page := 1; page <= 20; page++ {
		formData := url.Values{}
		formData.Set(csrfName, csrfValue)
		formData.Set("date-from", dateFrom)
		formData.Set("date-to", dateTo)

		target := fmt.Sprintf("%s/directories/events?page=%d&path=/events/", ddBaseURL, page)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, target, strings.NewReader(formData.Encode()))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("X-Requested-With", "XMLHttpRequest")
		req.Header.Set("Referer", ddBaseURL+"/events/")

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
			return nil, fmt.Errorf("listing page %d returned %d: %s", page, resp.StatusCode, string(body))
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

	raw.ImageURL = ev.Image

	return raw, nil
}

// schema.org JSON-LD types used by Discover Durham event pages.

type ddEvent struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	StartDate   string  `json:"startDate"`
	EndDate     string  `json:"endDate"`
	URL         string  `json:"url"`
	Image       string  `json:"image"`
	Location    ddPlace `json:"location"`
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
