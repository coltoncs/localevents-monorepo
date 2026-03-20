package scraper

import (
	"context"
	"errors"
	"log"
	"math/big"
	"regexp"
	"strings"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// Location represents a geographic area to search for events.
type Location struct {
	Name      string
	Latitude  float64
	Longitude float64
	RadiusKM  int
}

// RawEvent holds normalized event data from any source.
type RawEvent struct {
	ExternalID  string
	Source      string
	Title       string
	Description string
	VenueName   string
	Address     string
	City        string
	State       string
	Zip         string
	Latitude    float64
	Longitude   float64
	StartTime   time.Time
	EndTime     *time.Time
	Category    string
	ImageURL    string
	TicketURL   string
	PriceMin    *float64
	PriceMax    *float64
}

// EventSource is the interface that all event scrapers must implement.
type EventSource interface {
	Name() string
	FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error)
}

// Runner orchestrates fetching events from all sources for all locations.
type Runner struct {
	Sources   []EventSource
	Locations []Location
	Queries   *store.Queries
}

// prioritySources are local/community scrapers whose listings are preferred
// over aggregator sources when duplicates are detected.
var prioritySources = map[string]bool{
	"visitraleigh":   true,
	"discoverdurham": true,
}

// Run collects events from all sources, deduplicates across sources
// (favoring local/community listings), then upserts into the database.
func (r *Runner) Run(ctx context.Context) {
	log.Println("Running event scrape...")

	// Phase 1: collect all events from every source.
	var priorityEvents []RawEvent
	var aggregatorEvents []RawEvent

	for _, src := range r.Sources {
		for _, loc := range r.Locations {
			events, err := src.FetchEvents(ctx, loc)
			if err != nil {
				log.Printf("[%s] error fetching events for %s: %v", src.Name(), loc.Name, err)
				continue
			}
			log.Printf("[%s] %s: fetched %d events", src.Name(), loc.Name, len(events))

			if prioritySources[src.Name()] {
				priorityEvents = append(priorityEvents, events...)
			} else {
				aggregatorEvents = append(aggregatorEvents, events...)
			}
		}
	}

	// Phase 2: build an index of priority events for dedup lookups.
	// Key: normalized (venue, date) for general matching.
	type dedupKey struct {
		venue string
		date  string // YYYY-MM-DD
	}
	priorityIndex := make(map[dedupKey]*RawEvent)
	for i := range priorityEvents {
		e := &priorityEvents[i]
		key := dedupKey{
			venue: strings.ToLower(strings.TrimSpace(e.VenueName)),
			date:  e.StartTime.Format("2006-01-02"),
		}
		// Use title as additional disambiguation — multiple events at
		// the same venue on the same day are common.
		titleKey := dedupKey{
			venue: key.venue + "|" + normalizeTitle(e.Title),
			date:  key.date,
		}
		priorityIndex[titleKey] = e
		// Also index without title normalization for broader matching
		priorityIndex[key] = e
	}

	// Phase 3: deduplicate aggregator events against priority events.
	// When a match is found, enrich the priority event and skip the aggregator event.
	var survivingAggregator []RawEvent
	merged := 0
	for _, ae := range aggregatorEvents {
		key := dedupKey{
			venue: strings.ToLower(strings.TrimSpace(ae.VenueName)),
			date:  ae.StartTime.Format("2006-01-02"),
		}

		// Try title-based match first (more precise)
		titleKey := dedupKey{
			venue: key.venue + "|" + normalizeTitle(ae.Title),
			date:  key.date,
		}
		if pe, ok := priorityIndex[titleKey]; ok {
			enrichPriorityEvent(pe, &ae)
			merged++
			continue
		}

		// Try Hurricanes-specific cross-title matching
		if opponent := extractHurricanesOpponent(ae.Title); opponent != "" {
			for i := range priorityEvents {
				pe := &priorityEvents[i]
				if pe.StartTime.Format("2006-01-02") != key.date {
					continue
				}
				if peOpponent := extractHurricanesOpponent(pe.Title); peOpponent != "" &&
					strings.EqualFold(opponent, peOpponent) {
					enrichPriorityEvent(pe, &ae)
					merged++
					goto nextAggregator
				}
			}
		}

		// No match — keep the aggregator event
		survivingAggregator = append(survivingAggregator, ae)
	nextAggregator:
	}

	log.Printf("Dedup: merged %d aggregator events into priority events, %d aggregator events kept",
		merged, len(survivingAggregator))

	// Phase 4: upsert all events.
	total := 0
	for _, e := range append(priorityEvents, survivingAggregator...) {
		// Upsert venue if event has a venue name, then link it
		var venueID pgtype.UUID
		if e.VenueName != "" {
			venue, err := r.Queries.UpsertVenue(ctx, store.UpsertVenueParams{
				Name:      e.VenueName,
				Address:   textFromStr(e.Address),
				City:      textFromStr(e.City),
				State:     textFromStr(e.State),
				Zip:       textFromStr(e.Zip),
				Latitude:  e.Latitude,
				Longitude: e.Longitude,
			})
			if err != nil {
				log.Printf("[%s] error upserting venue %s: %v", e.Source, e.VenueName, err)
			} else {
				venueID = venue.ID
			}
		}

		_, err := r.Queries.UpsertExternalEvent(ctx, store.UpsertExternalEventParams{
			ExternalID:  textFromStr(e.ExternalID),
			Source:      e.Source,
			Title:       e.Title,
			Description: textFromStr(e.Description),
			VenueName:   textFromStr(e.VenueName),
			Address:     textFromStr(e.Address),
			City:        textFromStr(e.City),
			State:       textFromStr(e.State),
			Zip:         textFromStr(e.Zip),
			Latitude:    e.Latitude,
			Longitude:   e.Longitude,
			StartTime:   pgtype.Timestamptz{Time: e.StartTime, Valid: true},
			EndTime:     timestamptzFromPtr(e.EndTime),
			Category:    textFromStr(e.Category),
			ImageUrl:    textFromStr(e.ImageURL),
			TicketUrl:   textFromStr(e.TicketURL),
			PriceMin:    numericFromFloat(e.PriceMin),
			PriceMax:    numericFromFloat(e.PriceMax),
			VenueID:     venueID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			// Event was previously deleted by an admin; skip silently
			continue
		}
		if err != nil {
			log.Printf("[%s] error upserting event %s: %v", e.Source, e.ExternalID, err)
			continue
		}
		total++
	}

	log.Printf("Event scrape complete: %d total events upserted", total)
}

// enrichPriorityEvent fills in missing fields on a priority (local) event
// using data from a matching aggregator event. Time info and ticket URL
// from aggregators like Ticketmaster are typically more accurate.
func enrichPriorityEvent(pe, ae *RawEvent) {
	// Take the aggregator's time if it has an actual time component
	// (not midnight), since local sources often lack precise times.
	if ae.StartTime.Hour() != 0 || ae.StartTime.Minute() != 0 {
		pe.StartTime = ae.StartTime
	}
	if ae.EndTime != nil && pe.EndTime == nil {
		pe.EndTime = ae.EndTime
	}
	// Prefer aggregator ticket URL (direct purchase link)
	if ae.TicketURL != "" && pe.TicketURL == "" {
		pe.TicketURL = ae.TicketURL
	}
	// Fill in price if missing
	if ae.PriceMin != nil && pe.PriceMin == nil {
		pe.PriceMin = ae.PriceMin
	}
	if ae.PriceMax != nil && pe.PriceMax == nil {
		pe.PriceMax = ae.PriceMax
	}
	// Fill in category if missing
	if ae.Category != "" && pe.Category == "" {
		pe.Category = ae.Category
	}
}

// normalizeTitle lowercases a title and strips common filler words/punctuation
// for fuzzy dedup matching.
func normalizeTitle(title string) string {
	t := strings.ToLower(title)
	t = strings.ReplaceAll(t, " vs. ", " vs ")
	t = strings.ReplaceAll(t, " at ", " vs ")
	t = strings.ReplaceAll(t, " - ", " ")
	t = strings.ReplaceAll(t, ":", "")
	t = strings.ReplaceAll(t, "  ", " ")
	return strings.TrimSpace(t)
}

// hurricanesAtRe matches "X at Carolina Hurricanes" (Visit Raleigh format).
var hurricanesAtRe = regexp.MustCompile(`(?i)^(.+?)\s+at\s+carolina\s+hurricanes$`)

// hurricanesVsRe matches "Carolina Hurricanes vs. X" (Ticketmaster format).
var hurricanesVsRe = regexp.MustCompile(`(?i)^carolina\s+hurricanes\s+vs\.?\s+(.+)$`)

// extractHurricanesOpponent returns the opponent name if the title is a
// Carolina Hurricanes game in either the Raleigh or Ticketmaster format.
func extractHurricanesOpponent(title string) string {
	if m := hurricanesAtRe.FindStringSubmatch(title); len(m) == 2 {
		return strings.TrimSpace(m[1])
	}
	if m := hurricanesVsRe.FindStringSubmatch(title); len(m) == 2 {
		return strings.TrimSpace(m[1])
	}
	return ""
}

func textFromStr(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: s, Valid: true}
}

func timestamptzFromPtr(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func numericFromFloat(f *float64) pgtype.Numeric {
	if f == nil {
		return pgtype.Numeric{}
	}
	cents := int64(*f * 100)
	return pgtype.Numeric{
		Int:   big.NewInt(cents),
		Exp:   -2,
		Valid: true,
	}
}
