// Package planner builds a weekly, per-day event itinerary for each opted-in
// user. It runs alongside the weekly email digest: events near the user are
// grouped by day, ranked by preference (recommendation vector + preferred
// categories + proximity), trimmed to a daily shortlist, and ordered
// chronologically. The result is persisted to daily_plans for in-app viewing
// and optionally emailed.
package planner

// WeeklyPlan is the JSON shape persisted in daily_plans.plan and returned by
// GET /me/planner.
type WeeklyPlan struct {
	WeekOf string    `json:"week_of"` // YYYY-MM-DD, start of the plan window (ET)
	Days   []PlanDay `json:"days"`
}

// PlanDay is a single day's itinerary.
type PlanDay struct {
	Date    string     `json:"date"`    // YYYY-MM-DD
	Weekday string     `json:"weekday"` // e.g. "Monday, January 2"
	Items   []PlanItem `json:"items"`   // chronological
}

// PlanItem is one scheduled event, denormalized so the plan is stable even if
// the underlying event is later edited or removed.
type PlanItem struct {
	EventID       string  `json:"event_id"`
	Title         string  `json:"title"`
	StartTime     string  `json:"start_time"`           // RFC3339 (ET)
	TimeLabel     string  `json:"time_label"`           // e.g. "7:30 PM"
	VenueName     string  `json:"venue_name,omitempty"`
	Category      string  `json:"category,omitempty"`
	ImageURL      string  `json:"image_url,omitempty"`
	EventURL      string  `json:"event_url"`
	DistanceMiles float64 `json:"distance_miles"`
}

// totalItems counts every event across all days in a plan.
func totalItems(p WeeklyPlan) int {
	n := 0
	for _, d := range p.Days {
		n += len(d.Items)
	}
	return n
}
