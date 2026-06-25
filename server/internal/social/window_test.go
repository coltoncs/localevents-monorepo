package social

import (
	"testing"
	"time"
)

func TestWindowFor(t *testing.T) {
	loc, _ := time.LoadLocation("America/New_York")

	tests := []struct {
		name       string
		day        int // day in June 2026
		wantType   string
		wantStartD int // expected start day-of-month
		wantEndD   int // expected end day-of-month (exclusive)
	}{
		{"monday -> week Mon-Fri", 22, "week", 22, 27},
		{"wednesday -> week of current Mon", 24, "week", 22, 27},
		{"friday -> weekend Fri-Sun", 26, "weekend", 26, 29},
		{"sunday -> weekend of current Fri", 28, "weekend", 26, 29},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			now := time.Date(2026, 6, tt.day, 10, 0, 0, 0, loc)
			listType, _, start, end := windowFor(now, loc)
			if listType != tt.wantType {
				t.Errorf("listType = %q, want %q", listType, tt.wantType)
			}
			if start.Day() != tt.wantStartD {
				t.Errorf("start day = %d, want %d", start.Day(), tt.wantStartD)
			}
			if end.Day() != tt.wantEndD {
				t.Errorf("end day = %d, want %d", end.Day(), tt.wantEndD)
			}
			if start.Hour() != 0 || start.Minute() != 0 {
				t.Errorf("start not at midnight: %v", start)
			}
		})
	}
}

func TestDateRangeLabel(t *testing.T) {
	loc, _ := time.LoadLocation("America/New_York")
	sameMonth := dateRangeLabel(
		time.Date(2026, 6, 22, 0, 0, 0, 0, loc),
		time.Date(2026, 6, 27, 0, 0, 0, 0, loc),
	)
	if sameMonth != "Jun 22–26" {
		t.Errorf("same-month label = %q, want %q", sameMonth, "Jun 22–26")
	}
	crossMonth := dateRangeLabel(
		time.Date(2026, 6, 29, 0, 0, 0, 0, loc),
		time.Date(2026, 7, 4, 0, 0, 0, 0, loc),
	)
	if crossMonth != "Jun 29 – Jul 3" {
		t.Errorf("cross-month label = %q, want %q", crossMonth, "Jun 29 – Jul 3")
	}
}

func TestCitiesByName(t *testing.T) {
	cities := CitiesByName("Raleigh, Durham,Chapel Hill, Nowhere")
	if len(cities) != 3 {
		t.Fatalf("got %d cities, want 3 (unknown skipped)", len(cities))
	}
	if cities[0].Name != "Raleigh" || cities[2].Name != "Chapel Hill" {
		t.Errorf("unexpected order/resolution: %+v", cities)
	}
}
