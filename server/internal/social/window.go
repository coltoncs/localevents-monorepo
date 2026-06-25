package social

import (
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/scraper"
)

// windowFor returns the list type, card heading, and the [start, end) date
// window for a run at the given time. Friday–Sunday yield the weekend window
// (Fri–Sun of the current week); Monday–Thursday yield the week window
// (Mon–Fri). The window is anchored to the current week, so manual triggers on
// any day produce a sensible range rather than one relative to "today".
func windowFor(now time.Time, loc *time.Location) (listType, heading string, start, end time.Time) {
	day := startOfDay(now, loc)
	daysFromMonday := (int(now.Weekday()) + 6) % 7 // Mon=0 … Sun=6
	monday := day.AddDate(0, 0, -daysFromMonday)

	switch now.Weekday() {
	case time.Friday, time.Saturday, time.Sunday:
		friday := monday.AddDate(0, 0, 4)
		return "weekend", "Events This Weekend", friday, friday.AddDate(0, 0, 3) // Fri–Sun
	default:
		return "week", "Events This Week", monday, monday.AddDate(0, 0, 5) // Mon–Fri
	}
}

func startOfDay(t time.Time, loc *time.Location) time.Time {
	t = t.In(loc)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)
}

// dateRangeLabel renders an inclusive label for the [start, end) window, e.g.
// "Jun 23–27" or "Jun 30 – Jul 2" when the range spans two months.
func dateRangeLabel(start, end time.Time) string {
	last := end.AddDate(0, 0, -1)
	if start.Month() == last.Month() {
		return fmt.Sprintf("%s %d–%d", start.Format("Jan"), start.Day(), last.Day())
	}
	return fmt.Sprintf("%s %d – %s %d", start.Format("Jan"), start.Day(), last.Format("Jan"), last.Day())
}

func pgTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

// allCities is the union of every scraper city list, used to resolve the
// configured social-city allowlist by name.
var allCities = func() []scraper.Location {
	var out []scraper.Location
	out = append(out, scraper.NCCities...)
	out = append(out, scraper.VACities...)
	out = append(out, scraper.SCCities...)
	return out
}()

// CitiesByName resolves a comma-separated allowlist (case-insensitive) against
// the scraper city lists, preserving the order given. Unknown names are skipped.
func CitiesByName(csv string) []scraper.Location {
	index := make(map[string]scraper.Location, len(allCities))
	for _, c := range allCities {
		index[strings.ToLower(c.Name)] = c
	}
	var out []scraper.Location
	for _, name := range strings.Split(csv, ",") {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if c, ok := index[strings.ToLower(name)]; ok {
			out = append(out, c)
		}
	}
	return out
}
