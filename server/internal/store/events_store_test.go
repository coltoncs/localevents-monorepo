package store_test

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/store"
	"github.com/coltonsweeney/localevents/server/internal/testutil"
)

// Approximate coordinates used to verify radius filtering. Distances are
// computed by PostGIS ST_DWithin against the geography type.
var (
	raleighLat = 35.7796
	raleighLng = -78.6382
	durhamLat  = 35.9940 // ~25 mi NW of Raleigh
	durhamLng  = -78.8986
	charlotte  = struct{ lat, lng float64 }{35.2271, -80.8431} // ~140 mi SW
)

func TestListEventsByLocation_RadiusFilter(t *testing.T) {
	ctx, q := testutil.NewTx(t)

	now := time.Now().Add(1 * time.Hour)
	near := testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "Raleigh near", StartTime: now,
		Latitude: raleighLat, Longitude: raleighLng,
	})
	mid := testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "Durham mid", StartTime: now.Add(time.Hour),
		Latitude: durhamLat, Longitude: durhamLng,
	})
	far := testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "Charlotte far", StartTime: now.Add(2 * time.Hour),
		Latitude: charlotte.lat, Longitude: charlotte.lng,
	})

	// 10-mile radius from Raleigh: only the near event matches.
	results, err := q.ListEventsByLocation(ctx, store.ListEventsByLocationParams{
		Lng: raleighLng, Lat: raleighLat, RadiusMeters: 10 * 1609.34,
		StartDate:   pgtype.Timestamptz{Time: now.Add(-time.Hour), Valid: true},
		EndDate:     pgtype.Timestamptz{Time: now.Add(72 * time.Hour), Valid: true},
		EventOffset: 0, EventLimit: 50,
	})
	if err != nil {
		t.Fatalf("list 10mi: %v", err)
	}
	if got := eventTitles(results); !contains(got, near.Title) || contains(got, mid.Title) || contains(got, far.Title) {
		t.Fatalf("10mi radius: expected only %q, got %v", near.Title, got)
	}

	// 30-mile radius reaches Durham but not Charlotte.
	results, err = q.ListEventsByLocation(ctx, store.ListEventsByLocationParams{
		Lng: raleighLng, Lat: raleighLat, RadiusMeters: 30 * 1609.34,
		StartDate:   pgtype.Timestamptz{Time: now.Add(-time.Hour), Valid: true},
		EndDate:     pgtype.Timestamptz{Time: now.Add(72 * time.Hour), Valid: true},
		EventOffset: 0, EventLimit: 50,
	})
	if err != nil {
		t.Fatalf("list 30mi: %v", err)
	}
	got := eventTitles(results)
	if !contains(got, near.Title) || !contains(got, mid.Title) || contains(got, far.Title) {
		t.Fatalf("30mi radius: expected near+mid only, got %v", got)
	}
}

func TestListEventsByLocation_DateWindow(t *testing.T) {
	ctx, q := testutil.NewTx(t)

	base := time.Now().Truncate(time.Hour)
	tomorrow := testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "Tomorrow", StartTime: base.Add(24 * time.Hour),
	})
	nextWeek := testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "NextWeek", StartTime: base.Add(7 * 24 * time.Hour),
	})

	// Window: now -> 48 hours. Only "tomorrow" should appear.
	results, err := q.ListEventsByLocation(ctx, store.ListEventsByLocationParams{
		Lng: raleighLng, Lat: raleighLat, RadiusMeters: 50 * 1609.34,
		StartDate:   pgtype.Timestamptz{Time: base, Valid: true},
		EndDate:     pgtype.Timestamptz{Time: base.Add(48 * time.Hour), Valid: true},
		EventOffset: 0, EventLimit: 50,
	})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	got := eventTitles(results)
	if !contains(got, tomorrow.Title) || contains(got, nextWeek.Title) {
		t.Fatalf("expected only %q in window, got %v", tomorrow.Title, got)
	}
}

func TestListEventsByLocation_CategoryFilter(t *testing.T) {
	ctx, q := testutil.NewTx(t)

	now := time.Now().Add(time.Hour)
	music := testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "Concert", StartTime: now, Categories: []string{"music"},
	})
	food := testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "Food Fest", StartTime: now.Add(time.Hour), Categories: []string{"food"},
	})

	results, err := q.ListEventsByLocation(ctx, store.ListEventsByLocationParams{
		Lng: raleighLng, Lat: raleighLat, RadiusMeters: 50 * 1609.34,
		StartDate:   pgtype.Timestamptz{Time: now.Add(-time.Hour), Valid: true},
		EndDate:     pgtype.Timestamptz{Time: now.Add(72 * time.Hour), Valid: true},
		Category:    pgtype.Text{String: "music", Valid: true},
		EventOffset: 0, EventLimit: 50,
	})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	got := eventTitles(results)
	if !contains(got, music.Title) || contains(got, food.Title) {
		t.Fatalf("category=music: expected only %q, got %v", music.Title, got)
	}
}

func TestListEventsByLocation_SearchFilter(t *testing.T) {
	ctx, q := testutil.NewTx(t)

	now := time.Now().Add(time.Hour)
	hit := testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "Jazz Night at the Lincoln", StartTime: now,
	})
	miss := testutil.CreateEvent(t, q, testutil.EventOpts{
		Title: "Wine Tasting", StartTime: now.Add(time.Hour),
	})

	results, err := q.ListEventsByLocation(ctx, store.ListEventsByLocationParams{
		Lng: raleighLng, Lat: raleighLat, RadiusMeters: 50 * 1609.34,
		StartDate:   pgtype.Timestamptz{Time: now.Add(-time.Hour), Valid: true},
		EndDate:     pgtype.Timestamptz{Time: now.Add(72 * time.Hour), Valid: true},
		Search:      pgtype.Text{String: "jazz", Valid: true},
		EventOffset: 0, EventLimit: 50,
	})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	got := eventTitles(results)
	if !contains(got, hit.Title) || contains(got, miss.Title) {
		t.Fatalf("search=jazz: expected only %q, got %v", hit.Title, got)
	}
}

func TestCountEventsByLocation_MatchesList(t *testing.T) {
	ctx, q := testutil.NewTx(t)

	now := time.Now().Add(time.Hour)
	for i := 0; i < 3; i++ {
		testutil.CreateEvent(t, q, testutil.EventOpts{
			StartTime: now.Add(time.Duration(i) * time.Hour),
		})
	}

	count, err := q.CountEventsByLocation(ctx, store.CountEventsByLocationParams{
		Lng: raleighLng, Lat: raleighLat, RadiusMeters: 50 * 1609.34,
		StartDate: pgtype.Timestamptz{Time: now.Add(-time.Hour), Valid: true},
		EndDate:   pgtype.Timestamptz{Time: now.Add(72 * time.Hour), Valid: true},
	})
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 3 {
		t.Fatalf("expected 3 events, got %d", count)
	}
}

func eventTitles(events []store.Event) []string {
	out := make([]string, 0, len(events))
	for _, e := range events {
		out = append(out, e.Title)
	}
	return out
}

func contains(haystack []string, needle string) bool {
	for _, h := range haystack {
		if h == needle {
			return true
		}
	}
	return false
}
