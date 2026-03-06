package scraper

import (
	"context"
	"log"
	"math/big"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/store"
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

// Run iterates over all sources and locations, upserting events into the database.
func (r *Runner) Run(ctx context.Context) {
	log.Println("Running event scrape...")
	total := 0

	for _, src := range r.Sources {
		for _, loc := range r.Locations {
			events, err := src.FetchEvents(ctx, loc)
			if err != nil {
				log.Printf("[%s] error fetching events for %s: %v", src.Name(), loc.Name, err)
				continue
			}

			upserted := 0
			for _, e := range events {
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
				})
				if err != nil {
					log.Printf("[%s] error upserting event %s: %v", src.Name(), e.ExternalID, err)
					continue
				}
				upserted++
			}

			log.Printf("[%s] %s: fetched %d, upserted %d", src.Name(), loc.Name, len(events), upserted)
			total += upserted
		}
	}

	log.Printf("Event scrape complete: %d total events upserted", total)
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
