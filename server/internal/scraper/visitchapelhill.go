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

	"github.com/coltonsweeney/localevents/server/internal/metrics"
)

const (
	chTokenURL = "https://www.visitchapelhill.org/plugins/core/get_simple_token/"
	chBaseURL  = "https://www.visitchapelhill.org/includes/rest_v2/plugins_events_events_by_date/find/"
	chPageSize = 100
)

// VisitChapelHill implements EventSource for the Visit Chapel Hill events API.
// Same Simpleview backend as Visit Raleigh, but the rest_v2 endpoint takes
// the query as a single URL-encoded `json` parameter and wraps the result
// in an extra `docs` envelope.
type VisitChapelHill struct {
	Client *http.Client
}

// NewVisitChapelHill creates a new Visit Chapel Hill event source.
func NewVisitChapelHill() *VisitChapelHill {
	return &VisitChapelHill{
		Client: metrics.NewInstrumentedClient("visitchapelhill", 30*time.Second),
	}
}

func (c *VisitChapelHill) Name() string { return "visitchapelhill" }

// FetchEvents fetches events from Visit Chapel Hill. Only runs for the
// Chapel Hill location to avoid duplicate work.
func (c *VisitChapelHill) FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error) {
	if loc.Name != "Chapel Hill" {
		return nil, nil
	}

	token, err := c.fetchToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetching chapelhillevents token: %w", err)
	}

	// The API rejects date_range boundaries unless they sit at 00:00 in the
	// client's local timezone. Compute today's midnight in Eastern (Chapel
	// Hill's tz) and serialize as UTC.
	eastern, err := time.LoadLocation("America/New_York")
	if err != nil {
		return nil, fmt.Errorf("loading eastern timezone: %w", err)
	}
	nowEast := time.Now().In(eastern)
	startLocal := time.Date(nowEast.Year(), nowEast.Month(), nowEast.Day(), 0, 0, 0, 0, eastern)
	endLocal := startLocal.AddDate(0, 0, 30)
	startDate := startLocal.UTC().Format("2006-01-02T15:04:05.000Z")
	endDate := endLocal.UTC().Format("2006-01-02T15:04:05.000Z")

	var allEvents []RawEvent
	skip := 0
	for {
		body, total, err := c.fetchPage(ctx, token, startDate, endDate, skip)
		if err != nil {
			return nil, err
		}

		for _, ev := range body {
			instances, err := expandCHEvent(ev, eastern, startLocal, endLocal)
			if err != nil {
				continue
			}
			allEvents = append(allEvents, instances...)
		}

		skip += chPageSize
		if skip >= total {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}

	return allEvents, nil
}

func (c *VisitChapelHill) fetchToken(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, chTokenURL, nil)
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

// fetchPage retrieves one page of events and returns the events plus the
// reported total count.
func (c *VisitChapelHill) fetchPage(ctx context.Context, token, startDate, endDate string, skip int) ([]chEvent, int, error) {
	query := map[string]any{
		"filter": map[string]any{
			"active": true,
			"date_range": map[string]any{
				"start": map[string]string{"$date": startDate},
				"end":   map[string]string{"$date": endDate},
			},
		},
		"options": map[string]any{
			"limit":     chPageSize,
			"skip":      skip,
			"count":     true,
			"castDocs":  false,
			"fields":    chFields,
			"hooks":     []string{},
			"sort":      map[string]int{"date": 1, "rank": 1, "title_sort": 1},
		},
	}
	jsonBytes, err := json.Marshal(query)
	if err != nil {
		return nil, 0, fmt.Errorf("encoding query: %w", err)
	}

	params := url.Values{}
	params.Set("json", string(jsonBytes))
	params.Set("token", token)
	reqURL := chBaseURL + "?" + params.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("creating request: %w", err)
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("fetching page at skip=%d: %w", skip, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, fmt.Errorf("reading response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var envelope chResponse
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, 0, fmt.Errorf("parsing response: %w", err)
	}
	return envelope.Docs.Docs, envelope.Docs.Count, nil
}

// chFields is the projection passed to the Simpleview API. Mirrors the set
// the official site requests, plus description and address fields we use.
var chFields = map[string]int{
	"_id":         1,
	"title":       1,
	"description": 1,
	"location":    1,
	"address1":    1,
	"city":        1,
	"region":      1,
	"zip":         1,
	"latitude":    1,
	"longitude":   1,
	"date":        1,
	"startDate":   1,
	"endDate":     1,
	"startTime":   1,
	"endTime":     1,
	"recurrence":  1,
	"recurType":   1,
	"categories":  1,
	"media_raw":   1,
	"recid":       1,
	"url":         1,
	"absoluteUrl": 1,
	"linkUrl":     1,
	"admission":   1,
}

// parseCHTimeOfDay parses a "HH:MM:SS" or "HH:MM" string from the Chapel Hill
// API into an hour/minute pair. Returns nil if the string is empty or malformed.
func parseCHTimeOfDay(s string) *crTimeOfDay {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ":")
	if len(parts) < 2 {
		return nil
	}
	h := atoiOr(parts[0], -1)
	m := atoiOr(parts[1], -1)
	if h < 0 || h > 23 || m < 0 || m > 59 {
		return nil
	}
	return &crTimeOfDay{hour: h, min: m}
}

// chRecurrenceRule represents a parsed Visit Chapel Hill recurrence string.
// Only weekly recurrence (recurType=3) has been observed; the rule encodes the
// interval in weeks, the weekdays on which the event repeats, and an optional
// final date (inclusive).
type chRecurrenceRule struct {
	intervalWeeks int
	weekdays      []time.Weekday
	until         *time.Time // inclusive, midnight Eastern of the final date
}

var chRecurrenceRe = regexp.MustCompile(
	`(?i)^every\s+(?:(\d+)\s+)?weeks?\s+on\s+(.+?)(?:\s+until\s+(.+))?$`,
)

var chWeekdayNames = map[string]time.Weekday{
	"sunday":    time.Sunday,
	"monday":    time.Monday,
	"tuesday":   time.Tuesday,
	"wednesday": time.Wednesday,
	"thursday":  time.Thursday,
	"friday":    time.Friday,
	"saturday":  time.Saturday,
}

// parseCHRecurrence parses strings like:
//
//	"every week on Wednesday"
//	"every 2 weeks on Thursday"
//	"every week on Wednesday, Thursday, Friday, Saturday until June 6, 2026"
//
// Returns nil, nil for an empty input (caller should treat as one-off).
// Returns an error for malformed input the caller cannot expand.
func parseCHRecurrence(s string, loc *time.Location) (*chRecurrenceRule, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	m := chRecurrenceRe.FindStringSubmatch(s)
	if m == nil {
		return nil, fmt.Errorf("unrecognized recurrence: %q", s)
	}

	rule := &chRecurrenceRule{intervalWeeks: 1}
	if m[1] != "" {
		n := atoiOr(m[1], 0)
		if n <= 0 {
			return nil, fmt.Errorf("invalid recurrence interval: %q", s)
		}
		rule.intervalWeeks = n
	}

	for _, part := range strings.Split(m[2], ",") {
		name := strings.ToLower(strings.TrimSpace(part))
		wd, ok := chWeekdayNames[name]
		if !ok {
			return nil, fmt.Errorf("unrecognized weekday %q in recurrence: %q", part, s)
		}
		rule.weekdays = append(rule.weekdays, wd)
	}
	if len(rule.weekdays) == 0 {
		return nil, fmt.Errorf("no weekdays parsed from recurrence: %q", s)
	}

	if m[3] != "" {
		until, err := time.ParseInLocation("January 2, 2006", strings.TrimSpace(m[3]), loc)
		if err != nil {
			return nil, fmt.Errorf("parsing until date %q: %w", m[3], err)
		}
		// Inclusive — treat as end-of-day so a same-day instance still emits.
		untilEOD := until.Add(24*time.Hour - time.Nanosecond)
		rule.until = &untilEOD
	}

	return rule, nil
}

// expandCHEvent turns a raw API event into one or more RawEvents, expanding
// recurType=3 weekly recurrences into per-occurrence instances within the
// [windowStart, windowEnd) Eastern-local window. Each expanded instance gets
// a unique ExternalID derived from the master recid plus its date so that
// upserts identify each occurrence distinctly.
func expandCHEvent(ev chEvent, loc *time.Location, windowStart, windowEnd time.Time) ([]RawEvent, error) {
	base, err := mapCHEvent(ev)
	if err != nil {
		return nil, err
	}

	// recurType 0 (one-off) and 99 (multi-day span) need no expansion.
	// recurType 3 with a null/blank recurrence behaves like a one-off.
	if ev.RecurType != 3 {
		if base.StartTime.Before(windowStart) {
			return nil, nil
		}
		return []RawEvent{base}, nil
	}

	rule, err := parseCHRecurrence(ev.Recurrence, loc)
	if err != nil {
		return nil, err
	}
	if rule == nil {
		if base.StartTime.Before(windowStart) {
			return nil, nil
		}
		return []RawEvent{base}, nil
	}

	// Anchor week = the calendar week (Mon–Sun) containing the master's
	// original startDate. "Every N weeks" counts whole-week offsets from
	// that anchor, regardless of which weekday in the rule each instance lands on.
	startTOD := parseCHTimeOfDay(ev.StartTime)
	endTOD := parseCHTimeOfDay(ev.EndTime)

	originDay, err := chOriginDayLocal(ev, loc)
	if err != nil {
		return nil, err
	}
	anchorWeekStart := chStartOfWeek(originDay)

	scanStart := windowStart
	if originDay.After(scanStart) {
		scanStart = originDay
	}
	scanEnd := windowEnd
	if rule.until != nil && rule.until.Before(scanEnd) {
		scanEnd = *rule.until
	}

	weekdaySet := make(map[time.Weekday]bool, len(rule.weekdays))
	for _, wd := range rule.weekdays {
		weekdaySet[wd] = true
	}

	var instances []RawEvent
	for d := time.Date(scanStart.Year(), scanStart.Month(), scanStart.Day(), 0, 0, 0, 0, loc); !d.After(scanEnd); d = d.AddDate(0, 0, 1) {
		if !weekdaySet[d.Weekday()] {
			continue
		}
		weeksSinceAnchor := int(chStartOfWeek(d).Sub(anchorWeekStart).Hours()/24) / 7
		if weeksSinceAnchor < 0 || weeksSinceAnchor%rule.intervalWeeks != 0 {
			continue
		}

		inst := base
		inst.ExternalID = fmt.Sprintf("%s:%s", ev.RecID, d.Format("2006-01-02"))

		if startTOD != nil {
			inst.StartTime = time.Date(d.Year(), d.Month(), d.Day(),
				startTOD.hour, startTOD.min, 0, 0, loc).UTC()
		} else {
			inst.StartTime = d.UTC()
		}
		if endTOD != nil {
			endT := time.Date(d.Year(), d.Month(), d.Day(),
				endTOD.hour, endTOD.min, 0, 0, loc)
			if !endT.After(time.Date(d.Year(), d.Month(), d.Day(), startTOD.hour, startTOD.min, 0, 0, loc)) {
				endT = endT.Add(24 * time.Hour)
			}
			endU := endT.UTC()
			inst.EndTime = &endU
		} else {
			inst.EndTime = nil
		}
		instances = append(instances, inst)
	}
	return instances, nil
}

// chOriginDayLocal returns the master event's original start date as Eastern
// midnight (date-only, no time-of-day component).
func chOriginDayLocal(ev chEvent, loc *time.Location) (time.Time, error) {
	src := ev.StartDate
	if src == "" {
		src = ev.Date
	}
	if src == "" {
		return time.Time{}, fmt.Errorf("event %s has no start date", ev.RecID)
	}
	t, err := time.Parse(time.RFC3339Nano, src)
	if err != nil {
		t, err = time.Parse("2006-01-02T15:04:05.000Z", src)
		if err != nil {
			return time.Time{}, err
		}
	}
	local := t.In(loc)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc), nil
}

// chStartOfWeek returns the Monday at-or-before t (preserving t's location).
func chStartOfWeek(t time.Time) time.Time {
	offset := (int(t.Weekday()) + 6) % 7 // Mon=0, Sun=6
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location()).AddDate(0, 0, -offset)
}

func mapCHEvent(ev chEvent) (RawEvent, error) {
	raw := RawEvent{
		ExternalID: ev.RecID,
		Source:     "visitchapelhill",
		Title:      ev.Title,
	}

	if ev.Description != "" {
		raw.Description = stripHTML(ev.Description)
	}

	// Parse start date — midnight local-as-UTC, same pattern as Visit Raleigh.
	switch {
	case ev.StartDate != "":
		t, err := time.Parse(time.RFC3339Nano, ev.StartDate)
		if err != nil {
			t, err = time.Parse("2006-01-02T15:04:05.000Z", ev.StartDate)
			if err != nil {
				return RawEvent{}, fmt.Errorf("parsing start date: %w", err)
			}
		}
		raw.StartTime = t
	case ev.Date != "":
		t, err := time.Parse(time.RFC3339Nano, ev.Date)
		if err != nil {
			return RawEvent{}, fmt.Errorf("parsing date: %w", err)
		}
		raw.StartTime = t
	default:
		return RawEvent{}, fmt.Errorf("no date for event %s", ev.RecID)
	}

	if ev.EndDate != "" {
		t, err := time.Parse(time.RFC3339Nano, ev.EndDate)
		if err == nil {
			raw.EndTime = &t
		}
	}

	// Refine with structured time-of-day fields. startDate is midnight local
	// expressed in UTC, so adding the parsed hours yields the correct UTC moment.
	if startTOD := parseCHTimeOfDay(ev.StartTime); startTOD != nil {
		base := raw.StartTime
		raw.StartTime = base.Add(time.Duration(startTOD.hour)*time.Hour + time.Duration(startTOD.min)*time.Minute)
		if endTOD := parseCHTimeOfDay(ev.EndTime); endTOD != nil {
			endT := base.Add(time.Duration(endTOD.hour)*time.Hour + time.Duration(endTOD.min)*time.Minute)
			// Handle events that end past midnight by rolling to the next day.
			if !endT.After(raw.StartTime) {
				endT = endT.Add(24 * time.Hour)
			}
			raw.EndTime = &endT
		} else {
			// Clear the misleading 23:59:59 end time when we have no real end.
			raw.EndTime = nil
		}
	}

	if ev.Latitude != 0 && ev.Longitude != 0 {
		raw.Latitude = ev.Latitude
		raw.Longitude = ev.Longitude
	}

	raw.VenueName = ev.Location
	raw.Address = ev.Address1
	raw.City = ev.City
	raw.Zip = ev.Zip
	// The API doesn't return state. Visit Chapel Hill covers Orange County, NC.
	raw.State = "NC"

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
	}

	// Price / free admission from the free-text "admission" field. Copied into
	// every expanded recurrence instance via the base RawEvent.
	raw.PriceMin, raw.PriceMax, raw.IsFree = parseAdmission(ev.Admission)

	return raw, nil
}

// Visit Chapel Hill API response types — note the extra envelope around
// the docs array compared to Visit Raleigh's rest endpoint.

type chResponse struct {
	Docs chDocs `json:"docs"`
}

type chDocs struct {
	Count int       `json:"count"`
	Docs  []chEvent `json:"docs"`
}

type chEvent struct {
	ID          string       `json:"_id"`
	RecID       string       `json:"recid"`
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Date        string       `json:"date"`
	StartDate   string       `json:"startDate"`
	EndDate     string       `json:"endDate"`
	StartTime   string       `json:"startTime"`
	EndTime     string       `json:"endTime"`
	Address1    string       `json:"address1"`
	City        string       `json:"city"`
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
	Recurrence  string       `json:"recurrence"`
	RecurType   int          `json:"recurType"`
}
