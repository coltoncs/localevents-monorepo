package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/metrics"
)

const (
	vrTokenURL = "https://www.visitrichmondva.com/plugins/core/get_simple_token/"
	vrBaseURL  = "https://www.visitrichmondva.com/includes/rest_v2/plugins_events_events_by_date/find/"
	vrSiteURL  = "https://www.visitrichmondva.com"
	vrPageSize = 100
)

// VisitRichmond implements EventSource for the Visit Richmond VA events API.
type VisitRichmond struct {
	Client *http.Client
}

func NewVisitRichmond() *VisitRichmond {
	return &VisitRichmond{
		Client: metrics.NewInstrumentedClient("visitrichmond", 30*time.Second),
	}
}

func (v *VisitRichmond) Name() string { return "visitrichmond" }

func (v *VisitRichmond) FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error) {
	if loc.Name != "Richmond" {
		return nil, nil
	}

	token, err := v.fetchToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetching visitrichmond token: %w", err)
	}

	var allEvents []RawEvent
	skip := 0
	now := time.Now().UTC()
	// Richmond API requires dates at midnight Eastern Time expressed in UTC (ET = UTC-4).
	eastern, _ := time.LoadLocation("America/New_York")
	todayET := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, eastern)
	startDate := todayET.UTC().Format("2006-01-02T15:04:05.000Z")
	endDate := todayET.Add(30 * 24 * time.Hour).UTC().Format("2006-01-02T15:04:05.000Z")

	for {
		query := vrQuery{
			Filter: vrFilter{
				Active: true,
				And: []map[string]any{
					{
						"categories.catId": map[string]any{
							"$in": []string{
								"41", "44", "47", "52", "54", "56", "58",
								"64", "67", "70", "71", "72", "74",
							},
						},
					},
				},
				DateRange: vrDateRange{
					Start: map[string]string{"$date": startDate},
					End:   map[string]string{"$date": endDate},
				},
			},
			Options: vrOptions{
				Limit:    vrPageSize,
				Skip:     skip,
				Count:    true,
				CastDocs: false,
				Fields: map[string]int{
					"_id": 1, "title": 1, "description": 1,
					"location": 1, "address1": 1, "city": 1, "state": 1, "zip": 1,
					"latitude": 1, "longitude": 1,
					"date": 1, "startDate": 1, "endDate": 1,
					"categories": 1, "media_raw": 1, "admission": 1,
					"recid": 1, "url": 1, "absoluteUrl": 1, "linkUrl": 1,
					"recurrence": 1, "recurType": 1,
				},
				Hooks: []string{},
				Sort: map[string]int{
					"date": 1, "rank": 1, "title_sort": 1,
				},
			},
		}

		jsonBytes, err := json.Marshal(query)
		if err != nil {
			return nil, fmt.Errorf("marshaling query: %w", err)
		}

		params := url.Values{}
		params.Set("json", string(jsonBytes))
		params.Set("token", token)

		reqURL := vrBaseURL + "?" + params.Encode()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		if err != nil {
			return nil, fmt.Errorf("creating request: %w", err)
		}

		resp, err := v.Client.Do(req)
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

		var vrResp vrResponse
		if err := json.Unmarshal(body, &vrResp); err != nil {
			return nil, fmt.Errorf("parsing response: %w", err)
		}

		for _, ev := range vrResp.Docs.Docs {
			raw, err := mapVREvent(ev)
			if err != nil {
				continue
			}
			allEvents = append(allEvents, raw)
		}

		skip += vrPageSize
		if skip >= vrResp.Docs.Count {
			break
		}

		time.Sleep(200 * time.Millisecond)
	}

	return allEvents, nil
}

func (v *VisitRichmond) fetchToken(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, vrTokenURL, nil)
	if err != nil {
		return "", err
	}

	resp, err := v.Client.Do(req)
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

func mapVREvent(ev vrEvent) (RawEvent, error) {
	raw := RawEvent{
		ExternalID: ev.RecID,
		Source:     "visitrichmond",
		Title:      ev.Title,
	}

	if ev.Description != "" {
		raw.Description = stripHTML(ev.Description)
	}

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

	if ev.EndDate != "" {
		t, err := time.Parse(time.RFC3339Nano, ev.EndDate)
		if err == nil {
			raw.EndTime = &t
		}
	}

	raw.Latitude = ev.Latitude
	raw.Longitude = ev.Longitude

	raw.VenueName = ev.Location
	raw.Address = ev.Address1
	raw.City = ev.City
	raw.State = ev.State
	raw.Zip = ev.Zip

	if len(ev.Categories) > 0 {
		raw.Categories = []string{ev.Categories[0].CatName}
	}

	if len(ev.MediaRaw) > 0 && ev.MediaRaw[0].MediaURL != "" {
		raw.ImageURL = ev.MediaRaw[0].MediaURL
	}

	if ev.LinkURL != "" {
		raw.TicketURL = ev.LinkURL
	} else if ev.AbsoluteURL != "" {
		raw.TicketURL = ev.AbsoluteURL
	} else if ev.URL != "" {
		raw.TicketURL = vrSiteURL + ev.URL
	}

	// Price / free admission from the free-text "admission" field.
	raw.PriceMin, raw.PriceMax, raw.IsFree = parseAdmission(ev.Admission)

	return raw, nil
}

// Visit Richmond v2 API query types

type vrQuery struct {
	Filter  vrFilter  `json:"filter"`
	Options vrOptions `json:"options"`
}

type vrFilter struct {
	Active    bool                     `json:"active"`
	And       []map[string]any `json:"$and"`
	DateRange vrDateRange              `json:"date_range"`
}

type vrDateRange struct {
	Start map[string]string `json:"start"`
	End   map[string]string `json:"end"`
}

type vrOptions struct {
	Limit    int            `json:"limit"`
	Skip     int            `json:"skip"`
	Count    bool           `json:"count"`
	CastDocs bool           `json:"castDocs"`
	Fields   map[string]int `json:"fields"`
	Hooks    []string       `json:"hooks"`
	Sort     map[string]int `json:"sort"`
}

// Visit Richmond API response types

type vrResponse struct {
	Docs vrDocsWrapper `json:"docs"`
}

type vrDocsWrapper struct {
	Count int       `json:"count"`
	Docs  []vrEvent `json:"docs"`
}

type vrEvent struct {
	ID          string       `json:"_id"`
	RecID       string       `json:"recid"`
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
	Location    string       `json:"location"`
	Categories  []crCategory `json:"categories"`
	MediaRaw    []crMedia    `json:"media_raw"`
	Admission   string       `json:"admission"`
	URL         string       `json:"url"`
	AbsoluteURL string       `json:"absoluteUrl"`
	LinkURL     string       `json:"linkUrl"`
}
