// Package social generates branded "event card" images for social media. Twice
// a week a cron renders one card per configured city: Monday produces an "Events
// This Week" card (Mon–Fri), Friday an "Events This Weekend" card (Fri–Sun).
// Rendering is delegated to the frontend's Satori route; finished PNGs are
// uploaded to R2 and emailed to administrators for manual posting.
package social

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/metrics"
	"github.com/coltonsweeney/localevents/server/internal/notifier"
	"github.com/coltonsweeney/localevents/server/internal/scraper"
	"github.com/coltonsweeney/localevents/server/internal/storage"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

const (
	maxEventsPerDay = 5
	// Generous cap; we bucket and trim to maxEventsPerDay per day in Go.
	queryEventLimit = 500
)

// Generator renders social event cards. R2 and the render endpoint are required
// for the cron path; Email is optional (no gallery is sent when unconfigured).
type Generator struct {
	Queries      *store.Queries
	R2           *storage.R2Client
	Email        *notifier.EmailSender
	RenderURL    string
	RenderSecret string
	Cities       []scraper.Location
	FrontendURL  string
	AdminEmail   string
	client       *http.Client
}

// renderPayload is the JSON contract with the frontend /api/social-card route.
type renderPayload struct {
	City       string      `json:"city"`
	ListType   string      `json:"listType"` // "week" | "weekend"
	Heading    string      `json:"heading"`
	Subheading string      `json:"subheading"`
	BgURL      string      `json:"bgUrl"`
	Days       []renderDay `json:"days"`
}

type renderDay struct {
	Label  string        `json:"label"`
	Events []renderEvent `json:"events"`
}

type renderEvent struct {
	Title    string `json:"title"`
	Time     string `json:"time"`
	Venue    string `json:"venue"`
	Category string `json:"category"`
	Featured bool   `json:"featured"`
}

// Card holds the result of one city's render, returned to callers (the admin
// on-demand endpoint) and used in the gallery email.
type Card struct {
	City  string `json:"city"`
	URL   string `json:"url"`
	Count int    `json:"count"`
}

// RangeOptions parameterizes an on-demand generation over a custom date window.
type RangeOptions struct {
	Start, End time.Time          // [Start, End) in ET
	Heading    string             // card heading; defaults to "Events"
	Cities     []scraper.Location // defaults to the configured cities
	Recipient  string             // gallery recipient; defaults to AdminEmail
	BgURL      string             // optional background for every card in this run
}

// BgStatus describes the predefined background state for a configured city.
type BgStatus struct {
	City   string `json:"city"`
	URL    string `json:"url"`
	Exists bool   `json:"exists"`
}

// CityNames returns the configured city names, for populating admin UI.
func (g *Generator) CityNames() []string {
	names := make([]string, len(g.Cities))
	for i, c := range g.Cities {
		names[i] = c.Name
	}
	return names
}

func (g *Generator) httpClient() *http.Client {
	if g.client == nil {
		g.client = metrics.NewInstrumentedClient("social_render", 30*time.Second)
	}
	return g.client
}

// Run renders and uploads a card for every configured city, then emails the
// admin gallery. The list type (week vs weekend) is inferred from the current
// weekday so manual triggers on any day still produce a sensible window.
func (g *Generator) Run(ctx context.Context) {
	loc, _ := time.LoadLocation("America/New_York")
	now := time.Now().In(loc)
	listType, heading, start, end := windowFor(now, loc)

	log.Printf("Social: starting %s run for %d cities (window %s–%s)",
		listType, len(g.Cities), start.Format("Jan 2"), end.AddDate(0, 0, -1).Format("Jan 2"))

	results := g.generate(ctx, listType, heading, "", start, end, g.Cities)
	if len(results) > 0 {
		g.emailGallery(g.AdminEmail, heading, start, results)
	}
	log.Printf("Social: %s run complete (%d/%d cities generated)", listType, len(results), len(g.Cities))
}

// GenerateRange renders cards for a custom date window on demand, uploads them,
// emails the gallery to the chosen recipient (or AdminEmail), and returns the
// generated cards. Synchronous — intended for the admin endpoint.
func (g *Generator) GenerateRange(ctx context.Context, opts RangeOptions) ([]Card, error) {
	heading := strings.TrimSpace(opts.Heading)
	if heading == "" {
		heading = "Events"
	}
	cities := opts.Cities
	if len(cities) == 0 {
		cities = g.Cities
	}
	if len(cities) == 0 {
		return nil, fmt.Errorf("no cities to generate")
	}

	log.Printf("Social: on-demand generation for %d cities (window %s–%s)",
		len(cities), opts.Start.Format("Jan 2"), opts.End.AddDate(0, 0, -1).Format("Jan 2"))

	results := g.generate(ctx, "custom", heading, opts.BgURL, opts.Start, opts.End, cities)

	recipient := strings.TrimSpace(opts.Recipient)
	if recipient == "" {
		recipient = g.AdminEmail
	}
	if len(results) > 0 {
		g.emailGallery(recipient, heading, opts.Start, results)
	}
	return results, nil
}

// generate renders, uploads, and returns a card per city for the given window.
// listType is used only in the R2 object key. bgOverride, when non-empty, is
// used as the background for every card; otherwise each city's predefined
// background is used.
func (g *Generator) generate(ctx context.Context, listType, heading, bgOverride string, start, end time.Time, cities []scraper.Location) []Card {
	var results []Card
	for _, city := range cities {
		days := g.topEventsPerDay(ctx, city, start, end)
		count := 0
		for _, d := range days {
			count += len(d.Events)
		}
		if count == 0 {
			log.Printf("Social: no events for %s, skipping", city.Name)
			continue
		}

		// A city's saved background wins; the per-run override (bgOverride) only
		// fills cities that don't have one. Empty → the render route falls back to
		// flat teal. The existence check runs only when an override is present.
		bg := g.backgroundURL(city)
		if bgOverride != "" && !g.R2.Exists(ctx, cityBackgroundKey(city.Name)) {
			bg = bgOverride
		}

		payload := renderPayload{
			City:       city.Name,
			ListType:   listType,
			Heading:    heading,
			Subheading: fmt.Sprintf("%s · %s", city.Name, dateRangeLabel(start, end)),
			BgURL:      bg,
			Days:       days,
		}

		png, err := g.render(ctx, payload)
		if err != nil {
			log.Printf("Social: render failed for %s: %v", city.Name, err)
			continue
		}

		key := fmt.Sprintf("social/%s/%s-%s.png", citySlug(city.Name), start.Format("2006-01-02"), listType)
		url, err := g.R2.PutBytes(ctx, key, "image/png", png)
		if err != nil {
			log.Printf("Social: R2 upload failed for %s: %v", city.Name, err)
			continue
		}

		log.Printf("Social: generated card for %s (%d events) -> %s", city.Name, count, url)
		results = append(results, Card{City: city.Name, URL: url, Count: count})
	}
	return results
}

// topEventsPerDay queries events in the window near the city, buckets them by
// ET day (preserving the query's chronological order), sorts each day
// featured-first then earliest, and caps at maxEventsPerDay.
func (g *Generator) topEventsPerDay(ctx context.Context, city scraper.Location, start, end time.Time) []renderDay {
	loc, _ := time.LoadLocation("America/New_York")
	radiusMeters := float64(city.RadiusKM) * 1000

	events, err := g.Queries.ListUpcomingEventsForDigest(ctx, store.ListUpcomingEventsForDigestParams{
		Lng:          city.Longitude,
		Lat:          city.Latitude,
		RadiusMeters: radiusMeters,
		StartDate:    pgTimestamptz(start),
		EndDate:      pgTimestamptz(end),
		MaxEvents:    queryEventLimit,
	})
	if err != nil {
		log.Printf("Social: query events for %s: %v", city.Name, err)
		return nil
	}

	type bucket struct {
		label  string
		events []store.Event
	}
	bucketMap := make(map[string]*bucket)
	var order []string

	for _, e := range events {
		if !e.StartTime.Valid {
			continue
		}
		t := e.StartTime.Time.In(loc)
		dateKey := t.Format("2006-01-02")
		b, ok := bucketMap[dateKey]
		if !ok {
			b = &bucket{label: t.Format("Mon, Jan 2")}
			bucketMap[dateKey] = b
			order = append(order, dateKey)
		}
		b.events = append(b.events, e)
	}

	days := make([]renderDay, 0, len(order))
	for _, key := range order {
		b := bucketMap[key]
		// Stable sort keeps the query's earliest-first order within each group,
		// so the result is: featured (earliest-first), then the rest.
		sort.SliceStable(b.events, func(i, j int) bool {
			return b.events[i].IsFeatured && !b.events[j].IsFeatured
		})
		picked := b.events
		if len(picked) > maxEventsPerDay {
			picked = picked[:maxEventsPerDay]
		}
		rd := renderDay{Label: b.label}
		for _, e := range picked {
			rd.Events = append(rd.Events, toRenderEvent(e, loc))
		}
		days = append(days, rd)
	}
	return days
}

// render POSTs the payload to the frontend Satori route and returns PNG bytes.
func (g *Generator) render(ctx context.Context, payload renderPayload) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.RenderURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create render request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-render-secret", g.RenderSecret)

	resp, err := g.httpClient().Do(req)
	if err != nil {
		return nil, fmt.Errorf("render request: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		return nil, fmt.Errorf("read render response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("render returned %d: %s", resp.StatusCode, string(data))
	}
	return data, nil
}

// cityBackgroundKey is the R2 key for a city's predefined background. The .jpg
// extension is cosmetic — R2 serves whatever content-type was stored, which the
// render route honors — so PNG/WebP uploads work under the same key.
func cityBackgroundKey(cityName string) string {
	return "social-bg/" + citySlug(cityName) + ".jpg"
}

// backgroundURL returns the public URL of a city's predefined background. The
// render route drops it (flat-teal fallback) if no object exists at the key.
func (g *Generator) backgroundURL(city scraper.Location) string {
	base := strings.TrimRight(g.R2.PublicURL(), "/")
	if base == "" {
		return ""
	}
	return base + "/" + cityBackgroundKey(city.Name)
}

// BackgroundStatus reports, per configured city, the predefined background URL
// and whether an object currently exists there.
func (g *Generator) BackgroundStatus(ctx context.Context) []BgStatus {
	out := make([]BgStatus, 0, len(g.Cities))
	for _, c := range g.Cities {
		out = append(out, BgStatus{
			City:   c.Name,
			URL:    g.backgroundURL(c),
			Exists: g.R2.Exists(ctx, cityBackgroundKey(c.Name)),
		})
	}
	return out
}

// UploadCityBackground stores (overwriting) a city's predefined background and
// returns its public URL.
func (g *Generator) UploadCityBackground(ctx context.Context, cityName, contentType string, data []byte) (string, error) {
	if citySlug(cityName) == "" {
		return "", fmt.Errorf("city is required")
	}
	return g.R2.PutBytes(ctx, cityBackgroundKey(cityName), contentType, data)
}

// UploadTempBackground stores a one-off background (for on-demand generation)
// under social-bg/uploads/<id> and returns its public URL.
func (g *Generator) UploadTempBackground(ctx context.Context, id, contentType string, data []byte) (string, error) {
	return g.R2.PutBytes(ctx, "social-bg/uploads/"+id+".jpg", contentType, data)
}

func toRenderEvent(e store.Event, loc *time.Location) renderEvent {
	re := renderEvent{Title: e.Title, Featured: e.IsFeatured}
	if e.StartTime.Valid {
		re.Time = e.StartTime.Time.In(loc).Format("3:04 PM")
	}
	if e.VenueName.Valid {
		re.Venue = e.VenueName.String
	}
	if len(e.Categories) > 0 {
		re.Category = e.Categories[0]
	}
	return re
}

func citySlug(name string) string {
	return strings.ReplaceAll(strings.ToLower(strings.TrimSpace(name)), " ", "-")
}
