package scraper

import (
	"strings"
	"testing"
	"time"
)

func eastern(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatalf("loading eastern: %v", err)
	}
	return loc
}

// chTestWindow is [Mon 2026-10-05, Wed 2026-11-04) Eastern.
func chTestWindow(t *testing.T) (*time.Location, time.Time, time.Time) {
	loc := eastern(t)
	start := time.Date(2026, 10, 5, 0, 0, 0, 0, loc)
	return loc, start, start.AddDate(0, 0, 30)
}

func expandDates(t *testing.T, got []RawEvent, loc *time.Location) []string {
	t.Helper()
	var dates []string
	for _, g := range got {
		dates = append(dates, g.StartTime.In(loc).Format("2006-01-02"))
	}
	return dates
}

func assertDates(t *testing.T, got []RawEvent, loc *time.Location, want ...string) {
	t.Helper()
	gotDates := expandDates(t, got, loc)
	if strings.Join(gotDates, ",") != strings.Join(want, ",") {
		t.Fatalf("dates: got %v want %v", gotDates, want)
	}
}

func TestParseCHEventPage(t *testing.T) {
	page := []byte(`<html><script>
console.log(` + "`data`" + `, {"title":"Open Mic Night","leisure_event_id":"31156","admission":"Free",` +
		`"weburl":"https://example.com/cal","venue_name":"Steel String","latitude":35.9099,"longitude":-79.0725,` +
		`"venue_address":{"address_line_1":"106A South Greensboro Street","city":"Carrboro","postal_code":"27510"},` +
		`"categories":[{"label":"Food & Drink"}],"primary_image_url":"https://img/x.jpg",` +
		`"date_rule_sets":[{"start_date_at":"2024-12-09T05:00:00.000Z","start_time":"18:00:00","interval":1,` +
		`"recurrence_string":"Recurring weekly on Monday"}]});
console.log("more");</script></html>`)

	ev, err := parseCHEventPage(page)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.ID != "31156" || ev.Title != "Open Mic Night" || ev.VenueAddress.City != "Carrboro" {
		t.Errorf("unexpected event: %+v", ev)
	}
	if len(ev.DateRuleSets) != 1 || ev.DateRuleSets[0].RecurrenceString != "Recurring weekly on Monday" {
		t.Errorf("unexpected rule sets: %+v", ev.DateRuleSets)
	}

	raw := mapCHEvent(ev)
	if raw.TicketURL != "https://example.com/cal" || !raw.IsFree || raw.Categories[0] != "Food & Drink" {
		t.Errorf("unexpected mapping: %+v", raw)
	}

	if _, err := parseCHEventPage([]byte("<html>Access Denied</html>")); err == nil {
		t.Error("want error for page without embedded data")
	}
}

func TestParseCHRecurrence(t *testing.T) {
	tests := []struct {
		input   string
		want    chRecurrence
		wantErr bool
	}{
		{input: "Single date", want: chRecurrence{freq: chSingle}},
		{input: "Recurring daily, and ends on Nov 6, 2026", want: chRecurrence{freq: chDaily}},
		{input: "Recurring weekly on Wednesday", want: chRecurrence{freq: chWeekly, weekdays: []time.Weekday{time.Wednesday}}},
		{
			input: "Recurring weekly on Saturday, Sunday, and ends on Nov 22, 2026",
			want:  chRecurrence{freq: chWeekly, weekdays: []time.Weekday{time.Saturday, time.Sunday}},
		},
		{
			input: "Recurring weekly on Sunday, and ends after 4 occurrences",
			want:  chRecurrence{freq: chWeekly, weekdays: []time.Weekday{time.Sunday}},
		},
		{input: "Recurring every other week on Wednesday", want: chRecurrence{freq: chWeekly, weekdays: []time.Weekday{time.Wednesday}}},
		{input: "Recurring monthly on the second Friday", want: chRecurrence{freq: chMonthly, nth: 2, weekday: time.Friday}},
		{
			input: "Recurring monthly on the third Friday, and ends on Nov 20, 2026",
			want:  chRecurrence{freq: chMonthly, nth: 3, weekday: time.Friday},
		},
		{input: "Recurring monthly on the last Thursday", want: chRecurrence{freq: chMonthly, nth: -1, weekday: time.Thursday}},
		{
			input: "Recurring yearly on the fourth Wednesday of November",
			want:  chRecurrence{freq: chYearly, nth: 4, weekday: time.Wednesday, month: time.November},
		},
		{input: "Tuesdays at 7pm", wantErr: true},
		{input: "Recurring weekly on Funday", wantErr: true},
		{input: "Recurring monthly on day 15", wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			got, err := parseCHRecurrence(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("want error, got %+v", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.freq != tc.want.freq || got.nth != tc.want.nth || got.weekday != tc.want.weekday || got.month != tc.want.month {
				t.Errorf("got %+v want %+v", got, tc.want)
			}
			if len(got.weekdays) != len(tc.want.weekdays) {
				t.Fatalf("weekdays: got %v want %v", got.weekdays, tc.want.weekdays)
			}
			for i := range got.weekdays {
				if got.weekdays[i] != tc.want.weekdays[i] {
					t.Errorf("weekdays: got %v want %v", got.weekdays, tc.want.weekdays)
				}
			}
		})
	}
}

func TestExpandCHEvent_SingleDate(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	ev := chEvent{ID: "35356", Title: "Fallfest 2026", DateRuleSets: []chDateRuleSet{{
		StartDateAt:      "2026-10-10T04:00:00.000Z",
		StartTime:        "14:00:00",
		EndTime:          "17:00:00",
		RecurrenceString: "Single date",
	}}}

	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 instance, got %d", len(got))
	}
	if got[0].ExternalID != "35356" {
		t.Errorf("external_id: got %q want bare id", got[0].ExternalID)
	}
	wantStart := time.Date(2026, 10, 10, 18, 0, 0, 0, time.UTC) // 14:00 EDT
	if !got[0].StartTime.Equal(wantStart) {
		t.Errorf("start: got %s want %s", got[0].StartTime, wantStart)
	}
	if got[0].EndTime == nil || !got[0].EndTime.Equal(wantStart.Add(3*time.Hour)) {
		t.Errorf("end: got %v want %s", got[0].EndTime, wantStart.Add(3*time.Hour))
	}
}

func TestExpandCHEvent_SingleDateOutsideWindow(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	for _, startDateAt := range []string{"2026-09-01T04:00:00.000Z", "2026-12-04T05:00:00.000Z"} {
		ev := chEvent{ID: "1", DateRuleSets: []chDateRuleSet{{
			StartDateAt:      startDateAt,
			StartTime:        "18:00:00",
			RecurrenceString: "Single date",
		}}}
		got, err := expandCHEvent(ev, loc, winStart, winEnd)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got) != 0 {
			t.Errorf("%s: expected no instances, got %v", startDateAt, expandDates(t, got, loc))
		}
	}
}

func TestExpandCHEvent_MultipleSingleDates(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	// A film screened on two nights is two one-date rule sets.
	ev := chEvent{ID: "500", DateRuleSets: []chDateRuleSet{
		{StartDateAt: "2026-10-11T04:00:00.000Z", IsAllDay: true, StartTime: "00:00:00", RecurrenceString: "Single date"},
		{StartDateAt: "2026-10-13T04:00:00.000Z", IsAllDay: true, StartTime: "00:00:00", RecurrenceString: "Single date"},
	}}

	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertDates(t, got, loc, "2026-10-11", "2026-10-13")
	if got[0].ExternalID != "500:2026-10-11" || got[1].ExternalID != "500:2026-10-13" {
		t.Errorf("external_ids: got %q, %q", got[0].ExternalID, got[1].ExternalID)
	}
	if got[0].StartTime.In(loc).Hour() != 0 || got[0].EndTime != nil {
		t.Errorf("all-day: want local midnight and no end, got %s / %v", got[0].StartTime.In(loc), got[0].EndTime)
	}
}

func TestExpandCHEvent_Weekly(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	ev := chEvent{ID: "31156", DateRuleSets: []chDateRuleSet{{
		StartDateAt:      "2024-12-09T05:00:00.000Z", // far in the past
		StartTime:        "18:00:00",
		Interval:         1,
		RecurrenceString: "Recurring weekly on Monday",
	}}}

	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertDates(t, got, loc, "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02")
	for _, g := range got {
		if g.StartTime.In(loc).Hour() != 18 {
			t.Errorf("start: got %s want 18:00 local", g.StartTime.In(loc))
		}
		if g.EndTime != nil {
			t.Errorf("end: want nil without end_time, got %s", g.EndTime)
		}
	}
	if got[0].ExternalID != "31156:2026-10-05" {
		t.Errorf("external_id: got %q", got[0].ExternalID)
	}
}

func TestExpandCHEvent_EveryOtherWeek(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	// Anchor Wed 2026-04-29; every other Wednesday from then lands on
	// Sep 30 (before the window), Oct 14, Oct 28 and Nov 11 (after it).
	ev := chEvent{ID: "200", DateRuleSets: []chDateRuleSet{{
		StartDateAt:      "2026-04-29T04:00:00.000Z",
		StartTime:        "19:00:00",
		EndTime:          "22:00:00",
		Interval:         2,
		RecurrenceString: "Recurring every other week on Wednesday",
	}}}

	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertDates(t, got, loc, "2026-10-14", "2026-10-28")
}

func TestExpandCHEvent_WeeklyEndsAfterOccurrences(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	// "ends after 4 occurrences": last_occurrence_at carries the bound.
	ev := chEvent{ID: "300", DateRuleSets: []chDateRuleSet{{
		StartDateAt:      "2026-10-18T04:00:00.000Z",
		LastOccurrenceAt: "2026-10-25T16:30:00.000Z",
		StartTime:        "12:30:00",
		Interval:         1,
		RecurrenceString: "Recurring weekly on Sunday, and ends after 2 occurrences",
	}}}

	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertDates(t, got, loc, "2026-10-18", "2026-10-25")
}

func TestExpandCHEvent_WeeklyMultiDayEndsOn(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	ev := chEvent{ID: "301", DateRuleSets: []chDateRuleSet{{
		StartDateAt:      "2026-10-24T04:00:00.000Z",
		EndDateAt:        "2026-11-01T04:00:00.000Z",
		StartTime:        "13:00:00",
		EndTime:          "13:30:00",
		Interval:         1,
		RecurrenceString: "Recurring weekly on Saturday, Sunday, and ends on Nov 1, 2026",
	}}}

	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertDates(t, got, loc, "2026-10-24", "2026-10-25", "2026-10-31", "2026-11-01")
	// Nov 1 is after the DST change; wall-clock time must stay 13:00.
	if h := got[3].StartTime.In(loc).Hour(); h != 13 {
		t.Errorf("post-DST start hour: got %d want 13", h)
	}
}

func TestExpandCHEvent_Daily(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	ev := chEvent{ID: "400", DateRuleSets: []chDateRuleSet{{
		StartDateAt:      "2026-10-15T04:00:00.000Z",
		EndDateAt:        "2026-10-17T04:00:00.000Z",
		LastOccurrenceAt: "2026-10-17T04:00:00.000Z",
		StartTime:        "00:00:00",
		Interval:         1,
		RecurrenceString: "Recurring daily, and ends on Oct 17, 2026",
	}}}

	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertDates(t, got, loc, "2026-10-15", "2026-10-16", "2026-10-17")
}

func TestExpandCHEvent_MonthlyNthWeekday(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	tests := []struct {
		recurrence string
		want       string
	}{
		{"Recurring monthly on the second Friday", "2026-10-09"},
		{"Recurring monthly on the fourth Monday", "2026-10-26"},
		{"Recurring monthly on the last Friday", "2026-10-30"},
		{"Recurring monthly on the first Sunday", "2026-11-01"},
	}
	for _, tc := range tests {
		t.Run(tc.recurrence, func(t *testing.T) {
			ev := chEvent{ID: "600", DateRuleSets: []chDateRuleSet{{
				StartDateAt:      "2026-08-01T04:00:00.000Z",
				StartTime:        "18:00:00",
				Interval:         1,
				RecurrenceString: tc.recurrence,
			}}}
			got, err := expandCHEvent(ev, loc, winStart, winEnd)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			assertDates(t, got, loc, tc.want)
		})
	}
}

func TestExpandCHEvent_Yearly(t *testing.T) {
	loc := eastern(t)
	winStart := time.Date(2027, 11, 1, 0, 0, 0, 0, loc)
	winEnd := winStart.AddDate(0, 0, 30)
	ev := chEvent{ID: "700", DateRuleSets: []chDateRuleSet{{
		StartDateAt:      "2026-11-25T05:00:00.000Z",
		StartTime:        "16:00:00",
		Interval:         1,
		RecurrenceString: "Recurring yearly on the fourth Wednesday of November",
	}}}

	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertDates(t, got, loc, "2027-11-24")
}

func TestExpandCHEvent_OvernightWrap(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	ev := chEvent{ID: "800", DateRuleSets: []chDateRuleSet{{
		StartDateAt:      "2026-10-17T04:00:00.000Z",
		StartTime:        "22:00:00",
		EndTime:          "02:00:00",
		RecurrenceString: "Single date",
	}}}

	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 || got[0].EndTime == nil {
		t.Fatalf("expected 1 instance with an end time, got %+v", got)
	}
	if d := got[0].EndTime.Sub(got[0].StartTime); d != 4*time.Hour {
		t.Errorf("duration: got %s want 4h", d)
	}
}

func TestExpandCHEvent_UnparseableRule(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	ev := chEvent{ID: "900", DateRuleSets: []chDateRuleSet{{
		StartDateAt:      "2026-10-10T04:00:00.000Z",
		RecurrenceString: "Recurring monthly on day 15",
	}}}
	if _, err := expandCHEvent(ev, loc, winStart, winEnd); err == nil {
		t.Error("want error for unrecognized recurrence")
	}
}

func TestExpandCHEvent_SameDayShowtimesKeepsEarliest(t *testing.T) {
	loc, winStart, winEnd := chTestWindow(t)
	ev := chEvent{ID: "1000", DateRuleSets: []chDateRuleSet{
		{StartDateAt: "2026-10-18T04:00:00.000Z", StartTime: "19:00:00", RecurrenceString: "Single date"},
		{StartDateAt: "2026-10-18T04:00:00.000Z", StartTime: "14:30:00", RecurrenceString: "Single date"},
	}}

	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 instance, got %d", len(got))
	}
	if h, m := got[0].StartTime.In(loc).Hour(), got[0].StartTime.In(loc).Minute(); h != 14 || m != 30 {
		t.Errorf("start: got %02d:%02d want 14:30", h, m)
	}
}
