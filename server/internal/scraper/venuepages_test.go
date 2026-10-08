package scraper

import (
	"slices"
	"testing"
	"time"
)

func TestVenueDescriptionHTML(t *testing.T) {
	got := venueDescriptionHTML(withSupport("Openers & Co", `<p>Line one<br>line two</p><p>&lt;script&gt;x</p><!-- hidden -->`))
	want := "<p>with Openers & Co<br>Line one<br>line two<br>scriptx</p>"
	if got != want {
		t.Errorf("got  %q\nwant %q", got, want)
	}
}

func TestMapPinhookEvent(t *testing.T) {
	ev, ok := mapPinhookEvent(pinhookGQLEvent{
		ID: 42, Name: " Headliner ", Date: "2026-10-08", DoorTime: "19:00:00", StartTime: "",
		Support: "Opener", Tags: []string{"ALLindie", "ALLcommunity"},
	})
	if !ok {
		t.Fatal("expected event")
	}
	if ev.ExternalID != "pinhook-42" || ev.Title != "Headliner" {
		t.Errorf("id/title = %q / %q", ev.ExternalID, ev.Title)
	}
	if want := time.Date(2026, 10, 8, 19, 0, 0, 0, easternTZ); !ev.StartTime.Equal(want) {
		t.Errorf("start = %v, want door time %v", ev.StartTime, want)
	}
	if got := Categorize(&ev); !slices.Contains(got, "Music") || !slices.Contains(got, "Community") {
		t.Errorf("categories = %v", got)
	}
	if got := NormalizeGenres(ev.Genre); !slices.Equal(got, []string{"Indie"}) {
		t.Errorf("genres = %v", got)
	}
}

func TestParseMotorcoCalendar(t *testing.T) {
	page := []byte(`events: [
		{ title: 'DAN\'S SHOW &amp; FRIENDS', start: '2026-10-31 20:00', end: '2026-10-31 23:00', url: 'https:\/\/motorcomusic.com\/event\/dans-show\/', classNames: 'x', backgroundImage: 'https://img/sq.jpg' },
		{ title: 'CANCELLED: NOPE', start: '2026-11-01 20:00', url: 'https://motorcomusic.com/event/nope/', classNames: 'x' },
		{ title: 'DUPE', start: '2026-10-31 20:00', url: 'https:\/\/motorcomusic.com\/event\/dans-show\/', classNames: 'x' }
	]`)
	evs := parseMotorcoCalendar(page)
	if len(evs) != 2 {
		t.Fatalf("got %d events, want 2", len(evs))
	}
	if e := evs[0]; e.Title != "DAN'S SHOW & FRIENDS" || e.ExternalID != "https://motorcomusic.com/event/dans-show/" || e.ImageURL != "https://img/sq.jpg" || e.cancelled {
		t.Errorf("first event = %+v", e)
	}
	if e := evs[1]; e.Title != "NOPE" || !e.cancelled {
		t.Errorf("second event = %+v", e)
	}
}

func TestVenuePriceRange(t *testing.T) {
	if lo, hi, free := venuePriceRange([]venueTicket{{20}, {15}, {25}}); *lo != 15 || *hi != 25 || free {
		t.Errorf("got %v %v %v", *lo, *hi, free)
	}
	if lo, hi, free := venuePriceRange([]venueTicket{{0}}); lo != nil || hi != nil || !free {
		t.Error("all-$0 tickets should be free")
	}
	if lo, _, free := venuePriceRange(nil); lo != nil || free {
		t.Error("no tickets should be unknown, not free")
	}
}
