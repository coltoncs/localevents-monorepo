package planner

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/store"
)

func ts(t time.Time) pgtype.Timestamptz { return pgtype.Timestamptz{Time: t, Valid: true} }

func row(title string, start time.Time, distM float64, cats []string, pref interface{}) store.ListPlannerEventsForUserRow {
	return store.ListPlannerEventsForUserRow{
		Title:          title,
		StartTime:      ts(start),
		DistanceMeters: distM,
		Categories:     cats,
		PrefScore:      pref,
	}
}

func TestBuildItinerary_GroupsSortsAndCaps(t *testing.T) {
	loc, _ := time.LoadLocation("America/New_York")
	weekOf := time.Date(2026, 6, 15, 0, 0, 0, 0, loc) // Monday
	day1 := time.Date(2026, 6, 15, 0, 0, 0, 0, loc)
	day2 := time.Date(2026, 6, 16, 0, 0, 0, 0, loc)

	radius := 16093.4 // 10 miles

	// Day 1 has 7 events (should cap at maxItemsPerDay=5); day 2 has 1.
	rows := []store.ListPlannerEventsForUserRow{
		row("d1 9pm far", day1.Add(21*time.Hour), 15000, nil, nil),
		row("d1 8am near music", day1.Add(8*time.Hour), 500, []string{"music"}, nil),
		row("d1 noon", day1.Add(12*time.Hour), 3000, nil, nil),
		row("d1 6pm", day1.Add(18*time.Hour), 1000, nil, nil),
		row("d1 7pm", day1.Add(19*time.Hour), 2000, nil, nil),
		row("d1 10am", day1.Add(10*time.Hour), 4000, nil, nil),
		row("d1 3pm", day1.Add(15*time.Hour), 8000, nil, nil),
		row("d2 1pm", day2.Add(13*time.Hour), 2000, nil, nil),
	}

	plan := buildItinerary(rows, []string{"music"}, radius, weekOf, loc, "https://x.test")

	if plan.WeekOf != "2026-06-15" {
		t.Fatalf("week_of = %q, want 2026-06-15", plan.WeekOf)
	}
	if len(plan.Days) != 2 {
		t.Fatalf("got %d days, want 2", len(plan.Days))
	}

	d1, d2 := plan.Days[0], plan.Days[1]
	if d1.Date != "2026-06-15" || d2.Date != "2026-06-16" {
		t.Fatalf("day dates = %q, %q", d1.Date, d2.Date)
	}

	// Day 1 capped at 5.
	if len(d1.Items) != maxItemsPerDay {
		t.Fatalf("day1 items = %d, want %d", len(d1.Items), maxItemsPerDay)
	}
	// Survivors are displayed chronologically.
	for i := 1; i < len(d1.Items); i++ {
		if d1.Items[i-1].StartTime > d1.Items[i].StartTime {
			t.Fatalf("day1 not chronological: %q after %q", d1.Items[i].StartTime, d1.Items[i-1].StartTime)
		}
	}
	// The near + preferred-category event should survive the cap.
	var keptMusic bool
	for _, it := range d1.Items {
		if it.Title == "d1 8am near music" {
			keptMusic = true
		}
	}
	if !keptMusic {
		t.Fatalf("preferred-category near event was dropped from day1 shortlist")
	}

	if len(d2.Items) != 1 {
		t.Fatalf("day2 items = %d, want 1", len(d2.Items))
	}
}

func TestRankScore_PrefAndProximity(t *testing.T) {
	radius := 10000.0
	prefSet := map[string]bool{"music": true}

	// Strong vector match, nearby, category match -> high score.
	hi := rankScore(row("", time.Now(), 100, []string{"music"}, 0.9), prefSet, radius)
	// No vector, far, no category match -> low score.
	lo := rankScore(row("", time.Now(), 9000, []string{"art"}, nil), prefSet, radius)

	if hi <= lo {
		t.Fatalf("expected hi (%v) > lo (%v)", hi, lo)
	}
	// Cold-start (nil pref) must not panic and contributes 0 to the pref term.
	cold := rankScore(row("", time.Now(), 0, []string{"music"}, nil), prefSet, radius)
	if cold < weightCat { // category match + full proximity, no pref
		t.Fatalf("cold-start score %v below expected category+proximity floor", cold)
	}
}
