package scraper

import (
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

func TestParseCHRecurrence(t *testing.T) {
	loc := eastern(t)

	tests := []struct {
		name             string
		input            string
		wantNil          bool
		wantErr          bool
		wantInterval     int
		wantWeekdays     []time.Weekday
		wantUntilYMD     string // empty if no until
	}{
		{name: "empty", input: "", wantNil: true},
		{
			name:         "weekly single day",
			input:        "every week on Wednesday",
			wantInterval: 1,
			wantWeekdays: []time.Weekday{time.Wednesday},
		},
		{
			name:         "every 2 weeks",
			input:        "every 2 weeks on Thursday",
			wantInterval: 2,
			wantWeekdays: []time.Weekday{time.Thursday},
		},
		{
			name:         "every 4 weeks",
			input:        "every 4 weeks on Tuesday",
			wantInterval: 4,
			wantWeekdays: []time.Weekday{time.Tuesday},
		},
		{
			name:         "weekly multi day with until",
			input:        "every week on Wednesday, Thursday, Friday, Saturday until June 6, 2026",
			wantInterval: 1,
			wantWeekdays: []time.Weekday{time.Wednesday, time.Thursday, time.Friday, time.Saturday},
			wantUntilYMD: "2026-06-06",
		},
		{
			name:         "weekly two days with until",
			input:        "every week on Thursday, Friday until June 5, 2026",
			wantInterval: 1,
			wantWeekdays: []time.Weekday{time.Thursday, time.Friday},
			wantUntilYMD: "2026-06-05",
		},
		{name: "garbage", input: "Tuesdays at 7pm", wantErr: true},
		{name: "bad weekday", input: "every week on Funday", wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseCHRecurrence(tc.input, loc)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("want error, got %+v", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tc.wantNil {
				if got != nil {
					t.Fatalf("want nil rule, got %+v", got)
				}
				return
			}
			if got.intervalWeeks != tc.wantInterval {
				t.Errorf("interval: got %d want %d", got.intervalWeeks, tc.wantInterval)
			}
			if len(got.weekdays) != len(tc.wantWeekdays) {
				t.Fatalf("weekdays len: got %v want %v", got.weekdays, tc.wantWeekdays)
			}
			for i, wd := range got.weekdays {
				if wd != tc.wantWeekdays[i] {
					t.Errorf("weekday[%d]: got %v want %v", i, wd, tc.wantWeekdays[i])
				}
			}
			if tc.wantUntilYMD == "" {
				if got.until != nil {
					t.Errorf("want no until, got %v", *got.until)
				}
			} else {
				if got.until == nil {
					t.Fatalf("want until %s, got nil", tc.wantUntilYMD)
				}
				if got.until.In(loc).Format("2006-01-02") != tc.wantUntilYMD {
					t.Errorf("until date: got %s want %s", got.until.In(loc).Format("2006-01-02"), tc.wantUntilYMD)
				}
			}
		})
	}
}

func TestExpandCHEvent_OneOff(t *testing.T) {
	loc := eastern(t)
	winStart := time.Date(2026, 5, 25, 0, 0, 0, 0, loc)
	winEnd := winStart.AddDate(0, 0, 30)

	ev := chEvent{
		RecID:     "1",
		Title:     "Wine Tasting",
		Location:  "Rocks & Acid",
		StartDate: "2026-06-18T04:00:00.000Z", // midnight Eastern Jun 18
		EndDate:   "2026-06-19T03:59:59.000Z",
		StartTime: "16:00:00",
		EndTime:   "19:00:00",
		RecurType: 0,
	}
	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 instance, got %d", len(got))
	}
	want := time.Date(2026, 6, 18, 20, 0, 0, 0, time.UTC) // 16:00 EDT
	if !got[0].StartTime.Equal(want) {
		t.Errorf("start: got %s want %s", got[0].StartTime, want)
	}
}

func TestExpandCHEvent_DropsPastOneOff(t *testing.T) {
	loc := eastern(t)
	winStart := time.Date(2026, 5, 25, 0, 0, 0, 0, loc)
	winEnd := winStart.AddDate(0, 0, 30)

	ev := chEvent{
		RecID:     "1",
		Title:     "Old Event",
		StartDate: "2024-11-26T05:00:00.000Z",
		StartTime: "18:30:00",
		RecurType: 0,
	}
	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected 0 instances, got %d (start=%s)", len(got), got[0].StartTime)
	}
}

func TestExpandCHEvent_WeeklyRecurring(t *testing.T) {
	loc := eastern(t)
	// 2026-05-25 is a Monday; window May 25 - Jun 24.
	winStart := time.Date(2026, 5, 25, 0, 0, 0, 0, loc)
	winEnd := winStart.AddDate(0, 0, 30)

	ev := chEvent{
		RecID:      "100",
		Title:      "Drop-In Life Drawing",
		Location:   "Thomas Stevens Gallery",
		StartDate:  "2025-01-28T05:00:00.000Z", // Jan 28 2025 — far in the past
		StartTime:  "18:30:00",
		EndTime:    "20:30:00",
		RecurType:  3,
		Recurrence: "every week on Tuesday",
	}
	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Tuesdays in [May 25, Jun 24]: May 26, Jun 2, 9, 16, 23 — 5 instances.
	if len(got) != 5 {
		t.Fatalf("expected 5 instances, got %d", len(got))
	}
	wantDates := []string{"2026-05-26", "2026-06-02", "2026-06-09", "2026-06-16", "2026-06-23"}
	for i, ymd := range wantDates {
		if got[i].StartTime.In(loc).Format("2006-01-02") != ymd {
			t.Errorf("instance[%d]: got %s want %s", i, got[i].StartTime.In(loc), ymd)
		}
		if got[i].StartTime.In(loc).Hour() != 18 || got[i].StartTime.In(loc).Minute() != 30 {
			t.Errorf("instance[%d]: time = %s want 18:30 local", i, got[i].StartTime.In(loc))
		}
		wantID := "100:" + ymd
		if got[i].ExternalID != wantID {
			t.Errorf("instance[%d]: external_id %q want %q", i, got[i].ExternalID, wantID)
		}
	}
}

func TestExpandCHEvent_EveryTwoWeeks(t *testing.T) {
	loc := eastern(t)
	// Anchor: 2026-04-29 (Wednesday). Window May 25 - Jun 24.
	// Anchor week: Mon 2026-04-27. Bi-weekly Wednesdays from anchor:
	//   Apr 29 (week 0), May 13 (week 2), May 27 (week 4), Jun 10 (week 6), Jun 24 (week 8).
	// In window: May 27, Jun 10, Jun 24 = 3 instances.
	winStart := time.Date(2026, 5, 25, 0, 0, 0, 0, loc)
	winEnd := winStart.AddDate(0, 0, 30)

	ev := chEvent{
		RecID:      "200",
		Title:      "Biweekly Run Club",
		StartDate:  "2026-04-29T04:00:00.000Z", // Wed Apr 29 midnight Eastern
		StartTime:  "07:00:00",
		RecurType:  3,
		Recurrence: "every 2 weeks on Wednesday",
	}
	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	wantDates := []string{"2026-05-27", "2026-06-10", "2026-06-24"}
	if len(got) != len(wantDates) {
		var gotDates []string
		for _, g := range got {
			gotDates = append(gotDates, g.StartTime.In(loc).Format("2006-01-02"))
		}
		t.Fatalf("got %d instances %v, want %d %v", len(got), gotDates, len(wantDates), wantDates)
	}
	for i, ymd := range wantDates {
		if got[i].StartTime.In(loc).Format("2006-01-02") != ymd {
			t.Errorf("instance[%d]: got %s want %s", i, got[i].StartTime.In(loc), ymd)
		}
	}
}

func TestExpandCHEvent_MultiDayWithUntil(t *testing.T) {
	loc := eastern(t)
	winStart := time.Date(2026, 5, 25, 0, 0, 0, 0, loc)
	winEnd := winStart.AddDate(0, 0, 30)

	ev := chEvent{
		RecID:      "300",
		Title:      "Pop-Up Market",
		StartDate:  "2025-01-01T05:00:00.000Z",
		StartTime:  "10:00:00",
		EndTime:    "18:00:00",
		RecurType:  3,
		Recurrence: "every week on Thursday, Friday until June 5, 2026",
	}
	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// In [May 25, Jun 24] with until June 5, 2026 inclusive:
	//   Thu May 28, Fri May 29, Thu Jun 4, Fri Jun 5 = 4 instances.
	wantDates := []string{"2026-05-28", "2026-05-29", "2026-06-04", "2026-06-05"}
	if len(got) != len(wantDates) {
		var gotDates []string
		for _, g := range got {
			gotDates = append(gotDates, g.StartTime.In(loc).Format("2006-01-02"))
		}
		t.Fatalf("got %d instances %v, want %d %v", len(got), gotDates, len(wantDates), wantDates)
	}
}

func TestExpandCHEvent_OvernightWrap(t *testing.T) {
	loc := eastern(t)
	winStart := time.Date(2026, 5, 25, 0, 0, 0, 0, loc)
	winEnd := winStart.AddDate(0, 0, 30)

	ev := chEvent{
		RecID:      "400",
		Title:      "Late Show",
		StartDate:  "2025-01-01T05:00:00.000Z",
		StartTime:  "22:00:00",
		EndTime:    "02:00:00",
		RecurType:  3,
		Recurrence: "every week on Saturday",
	}
	got, err := expandCHEvent(ev, loc, winStart, winEnd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) == 0 {
		t.Fatal("expected instances, got none")
	}
	first := got[0]
	if first.EndTime == nil {
		t.Fatal("expected end time set")
	}
	if !first.EndTime.After(first.StartTime) {
		t.Errorf("end (%s) should be after start (%s)", first.EndTime, first.StartTime)
	}
	if first.EndTime.Sub(first.StartTime) != 4*time.Hour {
		t.Errorf("duration: got %s want 4h", first.EndTime.Sub(first.StartTime))
	}
}
