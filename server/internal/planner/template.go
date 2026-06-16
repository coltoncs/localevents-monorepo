package planner

import (
	"bytes"
	"fmt"
	"html/template"
)

// plannerEmailTemplate renders the weekly itinerary, grouped by day with a
// chronological list per day. Styling matches the digest email's day-group
// layout (internal/notifier/template.go).
var plannerEmailTemplate = template.Must(template.New("planner").Parse(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="background-color:#0d5c63;padding:24px 32px;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">Your Week Ahead</h1>
    <p style="margin:4px 0 0;color:#b2dfdb;font-size:14px;">{{.TotalCount}} events planned across your week</p>
  </td></tr>
  <tr><td style="padding:24px 32px;">
    {{range .Days}}{{if .Items}}
    <h2 style="margin:16px 0 12px;color:#0d5c63;font-size:16px;font-weight:600;border-bottom:2px solid #e0f2f1;padding-bottom:8px;">{{.Weekday}}</h2>
    {{range .Items}}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border-bottom:1px solid #e0e0e0;padding-bottom:20px;">
    <tr>
      {{if .ImageURL}}<td width="120" style="vertical-align:top;padding-right:16px;">
        <img src="{{.ImageURL}}" width="120" height="80" style="border-radius:6px;object-fit:cover;" alt="">
      </td>{{end}}
      <td style="vertical-align:top;">
        <a href="{{.EventURL}}" style="color:#0d5c63;font-size:16px;font-weight:600;text-decoration:none;">{{.Title}}</a>
        <p style="margin:4px 0 2px;color:#555;font-size:13px;">{{.TimeLabel}}{{if .VenueName}} &middot; {{.VenueName}}{{end}}</p>
        <p style="margin:2px 0;color:#888;font-size:12px;">{{printf "%.1f" .DistanceMiles}} mi away</p>
        {{if .Category}}<span style="display:inline-block;background:#e0f2f1;color:#0d5c63;font-size:11px;padding:2px 8px;border-radius:10px;margin-top:4px;">{{.Category}}</span>{{end}}
      </td>
    </tr>
    </table>
    {{end}}
    {{end}}{{end}}
    <p style="text-align:center;margin-top:24px;">
      <a href="{{.FrontendURL}}/planner" style="display:inline-block;background-color:#0d5c63;color:#ffffff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">View Your Planner</a>
    </p>
  </td></tr>
  <tr><td style="background-color:#f9f9f9;padding:16px 32px;text-align:center;font-size:12px;color:#999;">
    <a href="{{.UnsubscribeURL}}" style="color:#999;">Unsubscribe from emails</a>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`))

// RenderPlannerEmail renders a weekly plan into an HTML email body.
func RenderPlannerEmail(plan WeeklyPlan, unsubscribeURL, frontendURL string) (string, error) {
	data := struct {
		WeeklyPlan
		UnsubscribeURL string
		FrontendURL    string
		TotalCount     int
	}{
		WeeklyPlan:     plan,
		UnsubscribeURL: unsubscribeURL,
		FrontendURL:    frontendURL,
		TotalCount:     totalItems(plan),
	}

	var buf bytes.Buffer
	if err := plannerEmailTemplate.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("render planner email: %w", err)
	}
	return buf.String(), nil
}
