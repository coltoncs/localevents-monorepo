package testutil

import (
	"context"
	"fmt"
	"math/rand/v2"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/store"
)

// Raleigh, NC — used as the default coordinate for fixture events so
// geospatial queries against this point return the seeded rows.
const (
	DefaultLat = 35.7796
	DefaultLng = -78.6382
)

func randSuffix() string {
	return fmt.Sprintf("%08x", rand.Uint32())
}

// CreateUser inserts a user with a random Clerk ID. Pass a non-empty clerkID
// to override (useful when a test wants to assert on a known ID).
func CreateUser(t testing.TB, q *store.Queries, clerkID string) store.User {
	t.Helper()
	if clerkID == "" {
		clerkID = "user_test_" + randSuffix()
	}
	u, err := q.UpsertUser(context.Background(), store.UpsertUserParams{
		ClerkID: clerkID,
		Email:   pgtype.Text{String: clerkID + "@example.com", Valid: true},
	})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	return u
}

// EventOpts overrides defaults on CreateEvent. Zero values fall back to
// sensible defaults (random title, future start time, Raleigh coords).
type EventOpts struct {
	Title       string
	StartTime   time.Time
	Latitude    float64
	Longitude   float64
	Categories  []string
	SubmittedBy pgtype.UUID
	VenueName   string
	Source      string
}

func CreateEvent(t testing.TB, q *store.Queries, opts EventOpts) store.Event {
	t.Helper()
	if opts.Title == "" {
		opts.Title = "Test Event " + randSuffix()
	}
	if opts.StartTime.IsZero() {
		opts.StartTime = time.Now().Add(24 * time.Hour)
	}
	if opts.Latitude == 0 && opts.Longitude == 0 {
		opts.Latitude = DefaultLat
		opts.Longitude = DefaultLng
	}
	if opts.Source == "" {
		opts.Source = "user"
	}

	venueName := pgtype.Text{}
	if opts.VenueName != "" {
		venueName = pgtype.Text{String: opts.VenueName, Valid: true}
	}

	e, err := q.CreateEvent(context.Background(), store.CreateEventParams{
		Source:      opts.Source,
		Title:       opts.Title,
		VenueName:   venueName,
		Latitude:    opts.Latitude,
		Longitude:   opts.Longitude,
		StartTime:   pgtype.Timestamptz{Time: opts.StartTime, Valid: true},
		Categories:  opts.Categories,
		SubmittedBy: opts.SubmittedBy,
	})
	if err != nil {
		t.Fatalf("CreateEvent: %v", err)
	}
	return e
}

// CreateVenue inserts a venue with random name suffix. Latitude/Longitude
// default to Raleigh if zero.
func CreateVenue(t testing.TB, q *store.Queries, name string, lat, lng float64) store.Venue {
	t.Helper()
	if name == "" {
		name = "Test Venue " + randSuffix()
	}
	if lat == 0 && lng == 0 {
		lat = DefaultLat
		lng = DefaultLng
	}
	v, err := q.UpsertVenue(context.Background(), store.UpsertVenueParams{
		Name:      name,
		Latitude:  lat,
		Longitude: lng,
	})
	if err != nil {
		t.Fatalf("CreateVenue: %v", err)
	}
	return v
}
