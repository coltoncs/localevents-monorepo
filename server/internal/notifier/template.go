package notifier

import (
	"bytes"
	"fmt"
	"html/template"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/store"
)

type DigestData struct {
	SavedEvents     []EventData
	PreferredEvents []EventData
	OtherEvents     []EventData
	DayGroups       []DayGroup // used by "daily" format
	TotalCount      int
	UnsubscribeURL  string
	FrontendURL     string
	IsDailyFormat   bool
	IsCompact       bool
}

type DayGroup struct {
	DayLabel string
	Events   []EventData
}

type EventData struct {
	Title    string
	DateTime string
	Date     string // raw date for grouping (YYYY-MM-DD)
	Venue    string
	Category string // first category for display
	ImageURL string
	Price    string
	EventURL string
}

var detailedEventRowTpl = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border-bottom:1px solid #e0e0e0;padding-bottom:20px;">
    <tr>
      {{if .ImageURL}}<td width="120" style="vertical-align:top;padding-right:16px;">
        <img src="{{.ImageURL}}" width="120" height="80" style="border-radius:6px;object-fit:cover;" alt="">
      </td>{{end}}
      <td style="vertical-align:top;">
        <a href="{{.EventURL}}" style="color:#0d5c63;font-size:16px;font-weight:600;text-decoration:none;">{{.Title}}</a>
        <p style="margin:4px 0 2px;color:#555;font-size:13px;">{{.DateTime}}</p>
        {{if .Venue}}<p style="margin:2px 0;color:#555;font-size:13px;">{{.Venue}}</p>{{end}}
        {{if .Price}}<p style="margin:2px 0;color:#555;font-size:13px;">{{.Price}}</p>{{end}}
        {{if .Category}}<span style="display:inline-block;background:#e0f2f1;color:#0d5c63;font-size:11px;padding:2px 8px;border-radius:10px;margin-top:4px;">{{.Category}}</span>{{end}}
      </td>
    </tr>
    </table>`

var compactEventRowTpl = `
    <tr>
      <td style="padding:4px 0;font-size:13px;">
        <a href="{{.EventURL}}" style="color:#0d5c63;text-decoration:none;font-weight:600;">{{.Title}}</a>{{if .Venue}}<span style="color:#555;"> &middot; {{.Venue}}</span>{{end}}<span style="color:#888;"> &middot; {{.DateTime}}</span>
      </td>
    </tr>`

// compactSection wraps a list of compact rows in a table.
var compactSectionOpen = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">`
var compactSectionClose = `</table>`

var emailTemplate = template.Must(template.New("digest").Parse(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="background-color:#0d5c63;padding:24px 32px;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">Your Weekly Event Digest</h1>
    <p style="margin:4px 0 0;color:#b2dfdb;font-size:14px;">{{.TotalCount}} events near you this week</p>
  </td></tr>
  <tr><td style="padding:24px 32px;">
    {{if .SavedEvents}}
    <h2 style="margin:0 0 16px;color:#0d5c63;font-size:16px;font-weight:600;">Your Saved Events</h2>
    {{if .IsCompact}}` + compactSectionOpen + `{{range .SavedEvents}}` + compactEventRowTpl + `{{end}}` + compactSectionClose + `
    {{else}}{{range .SavedEvents}}` + detailedEventRowTpl + `{{end}}{{end}}
    {{end}}
    {{if .IsDailyFormat}}
    {{range .DayGroups}}
    <h2 style="margin:16px 0 12px;color:#0d5c63;font-size:16px;font-weight:600;border-bottom:2px solid #e0f2f1;padding-bottom:8px;">{{.DayLabel}}</h2>
    {{if $.IsCompact}}` + compactSectionOpen + `{{range .Events}}` + compactEventRowTpl + `{{end}}` + compactSectionClose + `
    {{else}}{{range .Events}}` + detailedEventRowTpl + `{{end}}{{end}}
    {{end}}
    {{else}}
    {{if .PreferredEvents}}
    <h2 style="margin:{{if .SavedEvents}}8px{{else}}0{{end}} 0 16px;color:#0d5c63;font-size:16px;font-weight:600;">Picked For You</h2>
    {{if .IsCompact}}` + compactSectionOpen + `{{range .PreferredEvents}}` + compactEventRowTpl + `{{end}}` + compactSectionClose + `
    {{else}}{{range .PreferredEvents}}` + detailedEventRowTpl + `{{end}}{{end}}
    {{end}}
    {{if .OtherEvents}}
    {{if or .SavedEvents .PreferredEvents}}
    <h2 style="margin:8px 0 16px;color:#555;font-size:16px;font-weight:600;">More Events</h2>
    {{end}}
    {{end}}
    {{if .IsCompact}}` + compactSectionOpen + `{{range .OtherEvents}}` + compactEventRowTpl + `{{end}}` + compactSectionClose + `
    {{else}}{{range .OtherEvents}}` + detailedEventRowTpl + `{{end}}{{end}}
    {{end}}
    <p style="text-align:center;margin-top:24px;">
      <a href="{{.FrontendURL}}" style="display:inline-block;background-color:#0d5c63;color:#ffffff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">View All Events</a>
    </p>
  </td></tr>
  <tr><td style="background-color:#f9f9f9;padding:16px 32px;text-align:center;font-size:12px;color:#999;">
    <a href="{{.UnsubscribeURL}}" style="color:#999;">Unsubscribe from email digests</a>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`))

func RenderDigestEmail(events, savedEvents []store.Event, preferredCategories []string, unsubscribeURL, frontendURL, digestFormat, emailStyle string) (string, error) {
	loc, _ := time.LoadLocation("America/New_York")

	// Build set of saved event IDs so we can exclude them from other sections.
	savedIDs := make(map[[16]byte]bool, len(savedEvents))
	var saved []EventData
	for _, e := range savedEvents {
		if e.ID.Valid {
			savedIDs[e.ID.Bytes] = true
		}
		saved = append(saved, toEventData(e, loc, frontendURL))
	}

	// Filter out saved events from the main list.
	var remaining []store.Event
	for _, e := range events {
		if e.ID.Valid && savedIDs[e.ID.Bytes] {
			continue
		}
		remaining = append(remaining, e)
	}

	data := DigestData{
		SavedEvents:    saved,
		UnsubscribeURL: unsubscribeURL,
		FrontendURL:    frontendURL,
		IsDailyFormat:  digestFormat == "daily",
		IsCompact:      emailStyle == "compact",
	}

	if digestFormat == "daily" {
		data.DayGroups = groupEventsByDay(remaining, loc, frontendURL)
		total := len(saved)
		for _, g := range data.DayGroups {
			total += len(g.Events)
		}
		data.TotalCount = total
	} else {
		prefSet := make(map[string]bool, len(preferredCategories))
		for _, c := range preferredCategories {
			prefSet[c] = true
		}
		for _, e := range remaining {
			ed := toEventData(e, loc, frontendURL)
			if len(prefSet) > 0 && hasPreferred(e.Categories, prefSet) {
				data.PreferredEvents = append(data.PreferredEvents, ed)
			} else {
				data.OtherEvents = append(data.OtherEvents, ed)
			}
		}
		data.TotalCount = len(saved) + len(data.PreferredEvents) + len(data.OtherEvents)
	}

	var buf bytes.Buffer
	if err := emailTemplate.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("render email template: %w", err)
	}
	return buf.String(), nil
}

const maxEventsPerDay = 10

// groupEventsByDay groups events by date and limits to the closest (earliest start time)
// events per day. Events are already sorted by proximity from the DB query (closest first).
func groupEventsByDay(events []store.Event, loc *time.Location, frontendURL string) []DayGroup {
	type dayBucket struct {
		date   string
		label  string
		events []EventData
	}

	bucketMap := make(map[string]*dayBucket)
	var dayOrder []string

	for _, e := range events {
		if !e.StartTime.Valid {
			continue
		}
		t := e.StartTime.Time.In(loc)
		dateKey := t.Format("2006-01-02")

		bucket, exists := bucketMap[dateKey]
		if !exists {
			label := t.Format("Monday, January 2")
			bucket = &dayBucket{date: dateKey, label: label}
			bucketMap[dateKey] = bucket
			dayOrder = append(dayOrder, dateKey)
		}

		if len(bucket.events) < maxEventsPerDay {
			bucket.events = append(bucket.events, toEventData(e, loc, frontendURL))
		}
	}

	groups := make([]DayGroup, 0, len(dayOrder))
	for _, key := range dayOrder {
		b := bucketMap[key]
		groups = append(groups, DayGroup{
			DayLabel: b.label,
			Events:   b.events,
		})
	}
	return groups
}

func toEventData(e store.Event, loc *time.Location, frontendURL string) EventData {
	ed := EventData{
		Title:    e.Title,
		EventURL: fmt.Sprintf("%s/events/%s", frontendURL, uuidToString(e.ID)),
	}
	if e.StartTime.Valid {
		ed.DateTime = e.StartTime.Time.In(loc).Format("Mon, Jan 2 at 3:04 PM")
	}
	if e.VenueName.Valid {
		ed.Venue = e.VenueName.String
	}
	if len(e.Categories) > 0 {
		ed.Category = e.Categories[0]
	}
	if e.ImageUrl.Valid {
		ed.ImageURL = e.ImageUrl.String
	}
	if e.PriceMin.Valid {
		price := formatNumeric(e.PriceMin)
		if e.PriceMax.Valid {
			maxPrice := formatNumeric(e.PriceMax)
			if maxPrice != price {
				price = price + " - " + maxPrice
			}
		}
		ed.Price = price
	}
	return ed
}
