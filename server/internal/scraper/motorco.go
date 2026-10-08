package scraper

import (
	"context"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/metrics"
)

const motorcoCalendarURL = "https://motorcomusic.com/calendar/"

// Motorco implements EventSource for Motorco Music Hall (Durham, NC).
//
// motorcomusic.com/calendar is a WordPress page using the Tickera Event
// Calendar plugin. The plugin renders a FullCalendar widget whose event list
// (every event, past and future: title, start, URL, square image) is written
// inline into the page as a JavaScript literal, so one request gets the list.
// Each event's own page has the description and the Tickera ticket table;
// tickets are sold on that same page, so it doubles as the ticket URL.
type Motorco struct {
	Client      *http.Client
	Concurrency int // parallel event-page fetches
}

// NewMotorco creates a new Motorco source.
func NewMotorco() *Motorco {
	return &Motorco{
		Client:      metrics.NewInstrumentedClient("motorco", 30*time.Second),
		Concurrency: 4,
	}
}

func (m *Motorco) Name() string { return "motorco" }

// motorcoEvent is a calendar entry plus what its event page adds.
type motorcoEvent struct {
	RawEvent
	cancelled bool
}

// FetchEvents only runs for the Durham location to avoid duplicate work.
// Cancelled shows are dropped.
func (m *Motorco) FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error) {
	if loc.Name != "Durham" {
		return nil, nil
	}

	page, _, err := m.get(ctx, motorcoCalendarURL)
	if err != nil {
		return nil, fmt.Errorf("calendar: %w", err)
	}
	all := parseMotorcoCalendar(page)
	if len(all) == 0 {
		return nil, errors.New("calendar: no events found (page layout may have changed)")
	}

	// The calendar includes every past show too.
	today := time.Now().In(easternTZ)
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, easternTZ)
	var evs []motorcoEvent
	for _, ev := range all {
		if !ev.StartTime.Before(today) {
			evs = append(evs, ev)
		}
	}

	// A failed event page still leaves the calendar's title, time and image.
	parallelEach(len(evs), m.Concurrency, func(i int) {
		if ctx.Err() != nil {
			return
		}
		if err := m.fillDetails(ctx, &evs[i]); err != nil {
			log.Printf("[motorco] %s: %v", evs[i].ExternalID, err)
		}
	})

	var out []RawEvent
	for _, ev := range evs {
		if !ev.cancelled {
			out = append(out, ev.RawEvent)
		}
	}
	return out, ctx.Err()
}

// ---- calendar page ----

// Matches one FullCalendar entry, e.g.
//
//	{ title: 'HALLOWEEN', start: '2026-10-31 20:00', end: '...', url: '...',
//	  classNames: '...', backgroundImage: '...' }
var (
	motorcoCalEntryRe = regexp.MustCompile(`(?s)\{\s*title: '(.*?)',\s*start: '([^']*)',(?:\s*end: '[^']*',)?\s*url: '([^']*)',([^{}]*)\}`)
	motorcoCalImageRe = regexp.MustCompile(`backgroundImage: '([^']*)'`)
)

func parseMotorcoCalendar(page []byte) []motorcoEvent {
	var out []motorcoEvent
	seen := map[string]bool{}
	for _, mm := range motorcoCalEntryRe.FindAllSubmatch(page, -1) {
		url := jsUnquote(string(mm[3]))
		if seen[url] {
			continue
		}
		seen[url] = true

		start, err := time.ParseInLocation("2006-01-02 15:04", string(mm[2]), easternTZ)
		if err != nil {
			continue
		}

		ev := motorcoEvent{RawEvent: RawEvent{
			ExternalID: url,
			Source:     "motorco",
			Title:      jsUnquote(string(mm[1])),
			VenueName:  "Motorco Music Hall",
			Address:    "723 Rigsbee Ave",
			City:       "Durham",
			State:      "NC",
			Zip:        "27701",
			Latitude:   36.00052,
			Longitude:  -78.90345,
			StartTime:  start.UTC(),
			Categories: []string{"Music"},
			TicketURL:  url,
		}}
		if im := motorcoCalImageRe.FindSubmatch(mm[4]); im != nil {
			ev.ImageURL = jsUnquote(string(im[1])) // square calendar thumbnail; replaced by the poster below
		}
		for _, prefix := range []string{"Cancelled:", "CANCELLED:"} {
			if t, ok := strings.CutPrefix(ev.Title, prefix); ok {
				ev.Title, ev.cancelled = strings.TrimSpace(t), true
			}
		}
		out = append(out, ev)
	}
	return out
}

// jsUnquote undoes the escaping inside a single-quoted JS string, plus any
// HTML entities WordPress left in the title.
func jsUnquote(s string) string {
	s = strings.NewReplacer(`\'`, `'`, `\"`, `"`, `\/`, `/`, `\\`, `\`).Replace(s)
	return strings.TrimSpace(html.UnescapeString(s))
}

// ---- event page ----

var (
	motorcoFeaturedRe   = regexp.MustCompile(`<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*>`)
	motorcoSrcsetRe     = regexp.MustCompile(`srcset="([^"]*)"`)
	motorcoSrcRe        = regexp.MustCompile(`\ssrc="([^"]*)"`)
	motorcoTicketDivRe  = regexp.MustCompile(`(?s)<div class="tickera">.*?</table>`)
	motorcoTicketRowRe  = regexp.MustCompile(`(?s)<tr>\s*<td title="([^"]*)">(.*?)</td>\s*<td>(.*?)</td>(.*?)</tr>`)
	motorcoPriceRe      = regexp.MustCompile(`\$\s*([\d,]+(?:\.\d+)?)`)
	motorcoH2Re         = regexp.MustCompile(`(?is)<h2[^>]*>\s*<span class="with">.*?</span>(.*?)</h2>`)
	motorcoH3EndRe      = regexp.MustCompile(`(?i)</h3>`)
	motorcoCancelledRe  = regexp.MustCompile(`(?i)this show has been cancel+ed`)
	motorcoLeadingWithR = regexp.MustCompile(`(?i)^with\s+`)
)

func (m *Motorco) fillDetails(ctx context.Context, ev *motorcoEvent) error {
	page, finalURL, err := m.get(ctx, ev.TicketURL)
	if err != nil {
		return fmt.Errorf("event page: %w", err)
	}
	ev.TicketURL = finalURL

	if img := motorcoFeaturedImage(page); img != "" {
		ev.ImageURL = img
	}

	// The event's own content runs from the entry-content div to the venue's
	// boilerplate policies, which every event repeats.
	body := string(page)
	start := strings.Index(body, `<div class="entry-content`)
	if start < 0 {
		return errors.New("event page: content block not found")
	}
	body = body[start:]
	if end := strings.Index(body, "Our policies"); end >= 0 {
		body = body[:end]
	} else if end := strings.Index(body, "<!-- .entry-content"); end >= 0 {
		body = body[:end]
	}

	// Motorco lists all-in prices ("Prices listed below include all fees").
	var tickets []venueTicket
	for _, r := range motorcoTicketRowRe.FindAllStringSubmatch(body, -1) {
		var t venueTicket
		if pm := motorcoPriceRe.FindStringSubmatch(r[3]); pm != nil {
			t.Price, _ = strconv.ParseFloat(strings.ReplaceAll(pm[1], ",", ""), 64)
		}
		tickets = append(tickets, t)
	}
	ev.PriceMin, ev.PriceMax, ev.IsFree = venuePriceRange(tickets)

	// Drop the ticket table and commented-out placeholders (the theme leaves
	// a commented "with OPENING BANDS" h2 on some events) before reading text.
	body = motorcoTicketDivRe.ReplaceAllString(body, "")
	body = vpCommentRe.ReplaceAllString(body, "")

	var support string
	if mm := motorcoH2Re.FindStringSubmatch(body); mm != nil {
		support = motorcoLeadingWithR.ReplaceAllString(venueHTMLToText(mm[1]), "")
	}
	if loc := motorcoH3EndRe.FindStringIndex(body); loc != nil {
		ev.Description = venueDescriptionHTML(withSupport(support, body[loc[1]:]))
	}
	if motorcoCancelledRe.MatchString(body) {
		ev.cancelled = true
	}
	return nil
}

// motorcoFeaturedImage returns the largest size of the event's poster.
func motorcoFeaturedImage(page []byte) string {
	tag := motorcoFeaturedRe.Find(page)
	if tag == nil {
		return ""
	}
	best, bestW := "", -1
	if mm := motorcoSrcsetRe.FindSubmatch(tag); mm != nil {
		for _, cand := range strings.Split(html.UnescapeString(string(mm[1])), ",") {
			f := strings.Fields(cand)
			if len(f) != 2 {
				continue
			}
			w, _ := strconv.Atoi(strings.TrimSuffix(f[1], "w"))
			if w > bestW {
				best, bestW = f[0], w
			}
		}
	}
	if best == "" {
		if mm := motorcoSrcRe.FindSubmatch(tag); mm != nil {
			best = html.UnescapeString(string(mm[1]))
		}
	}
	return best
}

func (m *Motorco) get(ctx context.Context, url string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := m.Client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	return b, resp.Request.URL.String(), err
}
