package scraper

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	chSitemapURL = "https://www.visitchapelhill.org/sitemap.xml"
	// chCrawlDelay honors the Crawl-delay in visitchapelhill.org/robots.txt.
	chCrawlDelay = 2 * time.Second
	chWindowDays = 30
)

// VisitChapelHill implements EventSource for visitchapelhill.org.
//
// The site's Simpleview JSON API (/includes/rest_v2/...) now returns an
// Akamai 403 to non-browser clients, so instead we read the event URLs from
// the sitemap and parse each event page. Every page embeds the full event
// record (times, admission, recurrence rules) as a JSON literal passed to
// console.log, which is far richer than the page's schema.org JSON-LD.
type VisitChapelHill struct {
	Client *http.Client
}

// NewVisitChapelHill creates a new Visit Chapel Hill event source.
func NewVisitChapelHill() *VisitChapelHill {
	return &VisitChapelHill{
		Client: newBrowserClient("visitchapelhill", 30*time.Second),
	}
}

func (c *VisitChapelHill) Name() string { return "visitchapelhill" }

// FetchEvents fetches events from Visit Chapel Hill. Only runs for the
// Chapel Hill location to avoid duplicate work.
func (c *VisitChapelHill) FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error) {
	if loc.Name != "Chapel Hill" {
		return nil, nil
	}

	eventURLs, err := c.fetchEventURLs(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetching sitemap: %w", err)
	}

	// Only keep occurrences starting within the next chWindowDays days,
	// measured from today's midnight in Eastern (Chapel Hill's tz).
	eastern, err := time.LoadLocation("America/New_York")
	if err != nil {
		return nil, fmt.Errorf("loading eastern timezone: %w", err)
	}
	nowEast := time.Now().In(eastern)
	windowStart := time.Date(nowEast.Year(), nowEast.Month(), nowEast.Day(), 0, 0, 0, 0, eastern)
	windowEnd := windowStart.AddDate(0, 0, chWindowDays)

	var allEvents []RawEvent
	var failures int
	var lastErr error
	for i, u := range eventURLs {
		if i > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(chCrawlDelay):
			}
		}

		ev, err := c.fetchEventPage(ctx, u)
		if err == nil {
			var instances []RawEvent
			instances, err = expandCHEvent(ev, eastern, windowStart, windowEnd)
			allEvents = append(allEvents, instances...)
		}
		if err != nil {
			failures++
			lastErr = fmt.Errorf("%s: %w", u, err)
		}
	}

	// A page-format change would make every page fail; surface that as an
	// error rather than silently reporting zero events.
	if len(eventURLs) > 0 && failures == len(eventURLs) {
		return nil, fmt.Errorf("all %d event pages failed, last: %w", failures, lastErr)
	}
	if failures > 0 {
		log.Printf("[visitchapelhill] skipped %d of %d event pages, last error: %v", failures, len(eventURLs), lastErr)
	}
	return allEvents, nil
}

var chSitemapEventRe = regexp.MustCompile(`<loc>(https://www\.visitchapelhill\.org/event/[^<]+)</loc>`)

// fetchEventURLs returns every event page URL listed in the sitemap.
func (c *VisitChapelHill) fetchEventURLs(ctx context.Context) ([]string, error) {
	body, err := c.get(ctx, chSitemapURL)
	if err != nil {
		return nil, err
	}
	var urls []string
	for _, m := range chSitemapEventRe.FindAllSubmatch(body, -1) {
		urls = append(urls, html.UnescapeString(string(m[1])))
	}
	if len(urls) == 0 {
		return nil, fmt.Errorf("no event URLs in sitemap")
	}
	return urls, nil
}

func (c *VisitChapelHill) fetchEventPage(ctx context.Context, pageURL string) (chEvent, error) {
	body, err := c.get(ctx, pageURL)
	if err != nil {
		return chEvent{}, err
	}
	return parseCHEventPage(body)
}

func (c *VisitChapelHill) get(ctx context.Context, target string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	return body, nil
}

// chDataMarker precedes the event record embedded in each event page:
//
//	console.log(`data`, {"title":"...","leisure_event_id":"31156",...});
var chDataMarker = []byte("console.log(`data`, ")

// parseCHEventPage extracts the embedded event record from an event page.
func parseCHEventPage(body []byte) (chEvent, error) {
	i := bytes.Index(body, chDataMarker)
	if i < 0 {
		return chEvent{}, fmt.Errorf("embedded event data not found")
	}
	// The decoder stops at the end of the object literal, ignoring the
	// trailing ");" and the rest of the page.
	var ev chEvent
	dec := json.NewDecoder(bytes.NewReader(body[i+len(chDataMarker):]))
	if err := dec.Decode(&ev); err != nil {
		return chEvent{}, fmt.Errorf("decoding embedded event data: %w", err)
	}
	if ev.ID == "" {
		return chEvent{}, fmt.Errorf("embedded event data has no leisure_event_id")
	}
	return ev, nil
}

// parseCHTimeOfDay parses a "HH:MM:SS" or "HH:MM" string from the Chapel Hill
// event data into an hour/minute pair. Returns nil if the string is empty or
// malformed.
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

// chFrequency is how often a date rule set repeats.
type chFrequency int

const (
	chSingle chFrequency = iota
	chDaily
	chWeekly
	chMonthly
	chYearly
)

// chRecurrence is the part of a date rule set that only its human-readable
// recurrence_string carries: the frequency and which day(s) it lands on. The
// interval and end bound come from the rule set's structured fields.
type chRecurrence struct {
	freq     chFrequency
	weekdays []time.Weekday // chWeekly
	// nth is the week-of-month ordinal (1–5) for chMonthly / chYearly, or -1
	// for "last".
	nth     int
	weekday time.Weekday // chMonthly / chYearly
	month   time.Month   // chYearly
}

var (
	chRecurrenceRe = regexp.MustCompile(
		`(?i)^recurring (daily|weekly|every other week|monthly|yearly)(?: on (.+?))?(?:,? and ends (?:on .+|after \d+ occurrences?))?$`,
	)
	chNthWeekdayRe = regexp.MustCompile(`(?i)^the (first|second|third|fourth|fifth|last) (\w+)(?: of (\w+))?$`)
	chListSepRe    = regexp.MustCompile(`(?i),\s*(?:and\s+)?|\s+and\s+`)
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

var chOrdinals = map[string]int{
	"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "last": -1,
}

// parseCHRecurrence parses a rule set's recurrence_string, e.g.:
//
//	"Single date"
//	"Recurring daily, and ends on Nov 6, 2026"
//	"Recurring weekly on Saturday, Sunday, and ends on Nov 22, 2026"
//	"Recurring every other week on Wednesday"
//	"Recurring monthly on the last Friday"
//	"Recurring yearly on the fourth Wednesday of November"
func parseCHRecurrence(s string) (chRecurrence, error) {
	s = strings.TrimSpace(s)
	if s == "" || strings.EqualFold(s, "single date") {
		return chRecurrence{freq: chSingle}, nil
	}
	m := chRecurrenceRe.FindStringSubmatch(s)
	if m == nil {
		return chRecurrence{}, fmt.Errorf("unrecognized recurrence: %q", s)
	}
	on := strings.TrimSpace(m[2])

	switch strings.ToLower(m[1]) {
	case "daily":
		return chRecurrence{freq: chDaily}, nil

	case "weekly", "every other week":
		rec := chRecurrence{freq: chWeekly}
		for _, part := range chListSepRe.Split(on, -1) {
			wd, ok := chWeekdayNames[strings.ToLower(strings.TrimSpace(part))]
			if !ok {
				return chRecurrence{}, fmt.Errorf("unrecognized weekday %q in recurrence: %q", part, s)
			}
			rec.weekdays = append(rec.weekdays, wd)
		}
		return rec, nil

	default: // monthly, yearly
		nm := chNthWeekdayRe.FindStringSubmatch(on)
		if nm == nil {
			return chRecurrence{}, fmt.Errorf("unrecognized recurrence: %q", s)
		}
		wd, ok := chWeekdayNames[strings.ToLower(nm[2])]
		if !ok {
			return chRecurrence{}, fmt.Errorf("unrecognized weekday %q in recurrence: %q", nm[2], s)
		}
		rec := chRecurrence{freq: chMonthly, nth: chOrdinals[strings.ToLower(nm[1])], weekday: wd}
		if strings.EqualFold(m[1], "yearly") {
			month, err := time.Parse("January", nm[3])
			if err != nil {
				return chRecurrence{}, fmt.Errorf("unrecognized month in recurrence: %q", s)
			}
			rec.freq = chYearly
			rec.month = month.Month()
		}
		return rec, nil
	}
}

// matches reports whether local date d (midnight, Eastern) is an occurrence
// of the rule, given the rule's first date and interval.
func (r chRecurrence) matches(d, first time.Time, interval int) bool {
	switch r.freq {
	case chSingle:
		return d.Equal(first)
	case chDaily:
		return chDaysBetween(first, d)%interval == 0
	case chWeekly:
		if !weekdayIn(d.Weekday(), r.weekdays) {
			return false
		}
		// "Every N weeks" counts whole-week offsets from the calendar week
		// (Mon–Sun) containing the first date, regardless of which weekday
		// in the rule each instance lands on.
		weeks := chDaysBetween(chStartOfWeek(first), chStartOfWeek(d)) / 7
		return weeks%interval == 0
	case chMonthly, chYearly:
		if d.Weekday() != r.weekday || !isNthWeekday(d, r.nth) {
			return false
		}
		if r.freq == chYearly {
			return d.Month() == r.month && (d.Year()-first.Year())%interval == 0
		}
		months := (d.Year()-first.Year())*12 + int(d.Month()) - int(first.Month())
		return months%interval == 0
	}
	return false
}

func weekdayIn(wd time.Weekday, set []time.Weekday) bool {
	for _, w := range set {
		if w == wd {
			return true
		}
	}
	return false
}

// isNthWeekday reports whether d is the nth occurrence of its weekday in its
// month (nth = -1 means the last).
func isNthWeekday(d time.Time, nth int) bool {
	if nth == -1 {
		return d.AddDate(0, 0, 7).Month() != d.Month()
	}
	return (d.Day()-1)/7+1 == nth
}

// chDaysBetween counts calendar days from a to b (both local midnights),
// robust to DST-shortened or -lengthened days.
func chDaysBetween(a, b time.Time) int {
	ua := time.Date(a.Year(), a.Month(), a.Day(), 0, 0, 0, 0, time.UTC)
	ub := time.Date(b.Year(), b.Month(), b.Day(), 0, 0, 0, 0, time.UTC)
	return int(ub.Sub(ua).Hours() / 24)
}

// chStartOfWeek returns the Monday at-or-before t (preserving t's location).
func chStartOfWeek(t time.Time) time.Time {
	offset := (int(t.Weekday()) + 6) % 7 // Mon=0, Sun=6
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location()).AddDate(0, 0, -offset)
}

// chLocalDate parses one of the API's UTC timestamps and returns the Eastern
// calendar date it falls on, as local midnight.
func chLocalDate(s string, loc *time.Location) (time.Time, error) {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return time.Time{}, err
	}
	t = t.In(loc)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc), nil
}

// expandCHEvent turns an event record into one RawEvent per occurrence whose
// date falls in [windowStart, windowEnd), across all of its date rule sets.
//
// An event with a single one-date rule set keeps the bare leisure_event_id as
// its ExternalID. Anything else — recurring rules, or several one-date rule
// sets (e.g. a film screening on three nights) — yields one instance per date
// with ExternalID "<id>:<YYYY-MM-DD>" so upserts identify each occurrence.
func expandCHEvent(ev chEvent, loc *time.Location, windowStart, windowEnd time.Time) ([]RawEvent, error) {
	if len(ev.DateRuleSets) == 0 {
		return nil, fmt.Errorf("event %s has no date rule sets", ev.ID)
	}
	base := mapCHEvent(ev)
	singleOccurrence := len(ev.DateRuleSets) == 1 &&
		strings.EqualFold(strings.TrimSpace(ev.DateRuleSets[0].RecurrenceString), "single date")

	var instances []RawEvent
	seen := make(map[string]int) // ExternalID -> index in instances
	for _, rs := range ev.DateRuleSets {
		rec, err := parseCHRecurrence(rs.RecurrenceString)
		if err != nil {
			return nil, err
		}
		first, err := chLocalDate(rs.StartDateAt, loc)
		if err != nil {
			return nil, fmt.Errorf("event %s: parsing start_date_at: %w", ev.ID, err)
		}
		interval := max(rs.Interval, 1)

		// Bounded rules report their final occurrence; fall back to the
		// rule's end date. Neither is set for open-ended rules.
		last := windowEnd
		for _, bound := range []string{rs.LastOccurrenceAt, rs.EndDateAt} {
			if bound == "" {
				continue
			}
			if t, err := chLocalDate(bound, loc); err == nil {
				if t.Before(last) {
					last = t.AddDate(0, 0, 1) // inclusive
				}
				break
			}
		}

		scanStart := windowStart
		if first.After(scanStart) {
			scanStart = first
		}
		for d := scanStart; d.Before(last) && d.Before(windowEnd); d = d.AddDate(0, 0, 1) {
			if !rec.matches(d, first, interval) {
				continue
			}
			inst := base
			if !singleOccurrence {
				inst.ExternalID = fmt.Sprintf("%s:%s", ev.ID, d.Format("2006-01-02"))
			}
			inst.StartTime, inst.EndTime = chOccurrenceTimes(d, rs, loc)
			// Matinee and evening showings on one date share an ExternalID;
			// list the earlier one.
			if i, ok := seen[inst.ExternalID]; ok {
				if inst.StartTime.Before(instances[i].StartTime) {
					instances[i] = inst
				}
				continue
			}
			seen[inst.ExternalID] = len(instances)
			instances = append(instances, inst)
		}
	}
	// Rule sets aren't listed chronologically.
	sort.SliceStable(instances, func(i, j int) bool {
		return instances[i].StartTime.Before(instances[j].StartTime)
	})
	return instances, nil
}

// chOccurrenceTimes returns the start and optional end instant of an
// occurrence on local date d. All-day occurrences start at local midnight
// with no end.
func chOccurrenceTimes(d time.Time, rs chDateRuleSet, loc *time.Location) (time.Time, *time.Time) {
	startTOD := parseCHTimeOfDay(rs.StartTime)
	if rs.IsAllDay || startTOD == nil {
		return d.UTC(), nil
	}
	start := time.Date(d.Year(), d.Month(), d.Day(), startTOD.hour, startTOD.min, 0, 0, loc)

	endTOD := parseCHTimeOfDay(rs.EndTime)
	if endTOD == nil {
		return start.UTC(), nil
	}
	end := time.Date(d.Year(), d.Month(), d.Day(), endTOD.hour, endTOD.min, 0, 0, loc)
	// Handle events that end past midnight by rolling to the next day.
	if !end.After(start) {
		end = end.AddDate(0, 0, 1)
	}
	endU := end.UTC()
	return start.UTC(), &endU
}

// mapCHEvent fills in every RawEvent field except the per-occurrence times.
func mapCHEvent(ev chEvent) RawEvent {
	raw := RawEvent{
		ExternalID:  ev.ID,
		Source:      "visitchapelhill",
		Title:       ev.Title,
		Description: stripHTML(ev.Description),
		VenueName:   ev.VenueName,
		Address:     ev.VenueAddress.AddressLine1,
		City:        ev.VenueAddress.City,
		Zip:         ev.VenueAddress.PostalCode,
		// Visit Chapel Hill covers Orange County, NC.
		State:    "NC",
		ImageURL: ev.PrimaryImageURL,
	}

	if ev.Latitude != 0 && ev.Longitude != 0 {
		raw.Latitude = ev.Latitude
		raw.Longitude = ev.Longitude
	}

	if len(ev.Categories) > 0 {
		raw.Categories = []string{ev.Categories[0].Label}
	}

	if ev.WebURL != "" {
		raw.TicketURL = ev.WebURL
	} else {
		raw.TicketURL = ev.AbsoluteURL
	}

	// Price / free admission from the free-text "admission" field. Copied into
	// every expanded occurrence via the base RawEvent.
	raw.PriceMin, raw.PriceMax, raw.IsFree = parseAdmission(ev.Admission)

	return raw
}

// chEvent is the event record embedded in each Visit Chapel Hill event page.
type chEvent struct {
	ID              string          `json:"leisure_event_id"`
	Title           string          `json:"title"`
	Description     string          `json:"description"`
	Admission       string          `json:"admission"`
	WebURL          string          `json:"weburl"`
	AbsoluteURL     string          `json:"absoluteUrl"`
	VenueName       string          `json:"venue_name"`
	VenueAddress    chAddress       `json:"venue_address"`
	Latitude        float64         `json:"latitude"`
	Longitude       float64         `json:"longitude"`
	PrimaryImageURL string          `json:"primary_image_url"`
	Categories      []chCategory    `json:"categories"`
	DateRuleSets    []chDateRuleSet `json:"date_rule_sets"`
}

type chAddress struct {
	AddressLine1 string `json:"address_line_1"`
	City         string `json:"city"`
	PostalCode   string `json:"postal_code"`
}

type chCategory struct {
	Label string `json:"label"`
}

// chDateRuleSet describes one schedule for an event. Timestamps are UTC;
// start_date_at / end_date_at are Eastern midnights, and start_time /
// end_time are Eastern wall-clock "HH:MM:SS".
type chDateRuleSet struct {
	StartDateAt      string `json:"start_date_at"`
	EndDateAt        string `json:"end_date_at"`
	LastOccurrenceAt string `json:"last_occurrence_at"`
	StartTime        string `json:"start_time"`
	EndTime          string `json:"end_time"`
	IsAllDay         bool   `json:"is_all_day_event"`
	Interval         int    `json:"interval"`
	RecurrenceString string `json:"recurrence_string"`
}
