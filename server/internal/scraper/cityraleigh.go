package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const (
	crTokenURL = "https://www.visitraleigh.com/plugins/core/get_simple_token/"
	crBaseURL  = "https://www.visitraleigh.com/includes/rest/plugins_events_events_by_date/find/"
	crPageSize = 100
)

// CityOfRaleigh implements EventSource for the Visit Raleigh events API.
type CityOfRaleigh struct {
	Client *http.Client
}

// NewCityOfRaleigh creates a new City of Raleigh event source.
func NewCityOfRaleigh() *CityOfRaleigh {
	return &CityOfRaleigh{
		Client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *CityOfRaleigh) Name() string { return "visitraleigh" }

// FetchEvents fetches events from Visit Raleigh. The Location parameter is
// ignored because this source only covers the Raleigh area.
func (c *CityOfRaleigh) FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error) {
	// Only run for Raleigh to avoid duplicate work across cities
	if loc.Name != "Raleigh" {
		return nil, nil
	}

	token, err := c.fetchToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetching raleighevents token: %w", err)
	}

	var allEvents []RawEvent
	skip := 0
	now := time.Now().UTC()
	startDate := now.Format("2006-01-02T15:04:05.000Z")
	endDate := now.Add(30 * 24 * time.Hour).Format("2006-01-02T15:04:05.000Z")

	for {
		params := url.Values{}
		params.Set("filter[sites]", "primary")
		params.Set("filter[date][$gte]", startDate)
		params.Set("filter[date][$lte]", endDate)
		params.Set("options[skip]", fmt.Sprintf("%d", skip))
		params.Set("options[limit]", fmt.Sprintf("%d", crPageSize))
		params.Set("options[hooks][]", "afterFind_listing")
		params.Add("options[hooks][]", "afterFind_host")
		params.Set("options[sort][date]", "1")
		params.Set("options[sort][rank]", "1")
		params.Set("options[sort][title]", "1")
		// Request only the fields we need
		for _, f := range []string{
			"title", "description", "address1", "city", "state", "zip",
			"latitude", "longitude", "location", "startDate", "endDate",
			"date", "categories", "media_raw", "url", "absoluteUrl",
			"admission", "recId", "loc", "times", "linkUrl",
		} {
			params.Set("options[fields]["+f+"]", "1")
		}
		params.Set("token", token)

		reqURL := crBaseURL + "?" + params.Encode()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		if err != nil {
			return nil, fmt.Errorf("creating request: %w", err)
		}

		resp, err := c.Client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("fetching page at skip=%d: %w", skip, err)
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("reading response: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
		}

		var crResp crResponse
		if err := json.Unmarshal(body, &crResp); err != nil {
			return nil, fmt.Errorf("parsing response: %w", err)
		}

		for _, ev := range crResp.Docs {
			raw, err := mapCREvent(ev)
			if err != nil {
				continue
			}
			allEvents = append(allEvents, raw)
		}

		skip += crPageSize
		if skip >= crResp.Total {
			break
		}

		// Rate limit
		time.Sleep(200 * time.Millisecond)
	}

	return allEvents, nil
}

func (c *CityOfRaleigh) fetchToken(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, crTokenURL, nil)
	if err != nil {
		return "", err
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	token := strings.TrimSpace(string(body))
	if len(token) != 32 {
		return "", fmt.Errorf("unexpected token format: %q", token)
	}
	return token, nil
}

var htmlTagRe = regexp.MustCompile(`<[^>]*>`)

func stripHTML(s string) string {
	return strings.TrimSpace(htmlTagRe.ReplaceAllString(s, ""))
}

// crTimeOfDay holds an extracted hour (0-23) and minute.
type crTimeOfDay struct {
	hour, min int
}

// Regexes for parsing the Visit Raleigh "times" field.
var (
	// "10am-10pm", "11am to 5pm", "6:30am - 2:30pm"
	crTimeRangeFull = regexp.MustCompile(`(?i)(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:[-–]+|\s+to\s+)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)`)
	// "5-10pm", "8-9:40pm" (start inherits am/pm from end)
	crTimeRangeShort = regexp.MustCompile(`(?i)(\d{1,2})(?::(\d{2}))?\s*[-–]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)`)
	// "2pm", "6:30pm"
	crTimeSingle = regexp.MustCompile(`(?i)(\d{1,2})(?::(\d{2}))?\s*(am|pm)`)
)

func to24(hour int, ampm string) int {
	ampm = strings.ToLower(ampm)
	if ampm == "am" && hour == 12 {
		return 0
	}
	if ampm == "pm" && hour != 12 {
		return hour + 12
	}
	return hour
}

func atoiOr(s string, def int) int {
	if s == "" {
		return def
	}
	n := 0
	for _, c := range s {
		n = n*10 + int(c-'0')
	}
	return n
}

// parseCRTimes extracts start and optional end time-of-day from the "times" field.
func parseCRTimes(s string) (start *crTimeOfDay, end *crTimeOfDay) {
	if s == "" {
		return nil, nil
	}
	// Normalize noon/midnight to parseable tokens
	norm := strings.NewReplacer("noon", "12pm", "Noon", "12pm", "midnight", "12am", "Midnight", "12am").Replace(s)

	// Try full range: "10am-10pm"
	if m := crTimeRangeFull.FindStringSubmatch(norm); m != nil {
		start = &crTimeOfDay{to24(atoiOr(m[1], 0), m[3]), atoiOr(m[2], 0)}
		end = &crTimeOfDay{to24(atoiOr(m[4], 0), m[6]), atoiOr(m[5], 0)}
		return
	}
	// Try short range: "5-10pm"
	if m := crTimeRangeShort.FindStringSubmatch(norm); m != nil {
		start = &crTimeOfDay{to24(atoiOr(m[1], 0), m[5]), atoiOr(m[2], 0)}
		end = &crTimeOfDay{to24(atoiOr(m[3], 0), m[5]), atoiOr(m[4], 0)}
		return
	}
	// Try single time: "2pm"
	if m := crTimeSingle.FindStringSubmatch(norm); m != nil {
		start = &crTimeOfDay{to24(atoiOr(m[1], 0), m[3]), atoiOr(m[2], 0)}
		return
	}
	return nil, nil
}

func mapCREvent(ev crEvent) (RawEvent, error) {
	raw := RawEvent{
		ExternalID: ev.RecID,
		Source:     "visitraleigh",
		Title:      ev.Title,
	}

	if ev.Description != "" {
		raw.Description = stripHTML(ev.Description)
	}

	// Parse start date
	if ev.StartDate != "" {
		t, err := time.Parse(time.RFC3339Nano, ev.StartDate)
		if err != nil {
			t, err = time.Parse("2006-01-02T15:04:05.000Z", ev.StartDate)
			if err != nil {
				return RawEvent{}, fmt.Errorf("parsing start date: %w", err)
			}
		}
		raw.StartTime = t
	} else if ev.Date != "" {
		t, err := time.Parse(time.RFC3339Nano, ev.Date)
		if err != nil {
			return RawEvent{}, fmt.Errorf("parsing date: %w", err)
		}
		raw.StartTime = t
	} else {
		return RawEvent{}, fmt.Errorf("no date for event %s", ev.RecID)
	}

	// Parse end date
	if ev.EndDate != "" {
		t, err := time.Parse(time.RFC3339Nano, ev.EndDate)
		if err == nil {
			raw.EndTime = &t
		}
	}

	// Refine start/end with the human-readable "times" field.
	// startDate from the API is midnight local time expressed in UTC,
	// so adding parsed hours gives the correct UTC event time.
	if startTOD, endTOD := parseCRTimes(ev.Times); startTOD != nil {
		base := raw.StartTime // midnight local in UTC
		raw.StartTime = base.Add(time.Duration(startTOD.hour)*time.Hour + time.Duration(startTOD.min)*time.Minute)
		if endTOD != nil {
			endT := base.Add(time.Duration(endTOD.hour)*time.Hour + time.Duration(endTOD.min)*time.Minute)
			raw.EndTime = &endT
		} else {
			// Clear the misleading 23:59:59 end time
			raw.EndTime = nil
		}
	}

	// Location coordinates
	if ev.Latitude != 0 && ev.Longitude != 0 {
		raw.Latitude = ev.Latitude
		raw.Longitude = ev.Longitude
	} else if ev.Loc.Type == "Point" && len(ev.Loc.Coordinates) == 2 {
		raw.Longitude = ev.Loc.Coordinates[0]
		raw.Latitude = ev.Loc.Coordinates[1]
	}

	raw.VenueName = ev.Location
	raw.Address = ev.Address1
	raw.City = ev.City
	raw.State = ev.State
	raw.Zip = ev.Zip

	// Categories from classifications
	if len(ev.Categories) > 0 {
		raw.Categories = []string{ev.Categories[0].CatName}
	}

	// Image
	if len(ev.MediaRaw) > 0 && ev.MediaRaw[0].MediaURL != "" {
		raw.ImageURL = ev.MediaRaw[0].MediaURL
	}

	// URL — prefer the ticket link, fall back to the absolute page URL
	if ev.LinkURL != "" {
		raw.TicketURL = ev.LinkURL
	} else if ev.AbsoluteURL != "" {
		raw.TicketURL = ev.AbsoluteURL
	}

	return raw, nil
}

// Visit Raleigh API response types

type crResponse struct {
	Docs  []crEvent `json:"docs"`
	Total int       `json:"total"`
}

type crEvent struct {
	ID          string       `json:"_id"`
	RecID       string       `json:"recId"`
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Date        string       `json:"date"`
	StartDate   string       `json:"startDate"`
	EndDate     string       `json:"endDate"`
	Address1    string       `json:"address1"`
	City        string       `json:"city"`
	State       string       `json:"state"`
	Zip         string       `json:"zip"`
	Latitude    float64      `json:"latitude"`
	Longitude   float64      `json:"longitude"`
	Loc         crGeoPoint   `json:"loc"`
	Location    string       `json:"location"`
	Categories  []crCategory `json:"categories"`
	MediaRaw    []crMedia    `json:"media_raw"`
	Admission   string       `json:"admission"`
	URL         string       `json:"url"`
	AbsoluteURL string       `json:"absoluteUrl"`
	LinkURL     string       `json:"linkUrl"`
	Times       string       `json:"times"`
}

type crGeoPoint struct {
	Type        string    `json:"type"`
	Coordinates []float64 `json:"coordinates"`
}

type crCategory struct {
	CatName string `json:"catName"`
	CatID   string `json:"catId"`
}

type crMedia struct {
	MediaURL  string `json:"mediaurl"`
	SortOrder int    `json:"sortorder"`
	MediaType string `json:"mediatype"`
}
