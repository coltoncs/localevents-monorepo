package notifier

import (
	"bytes"
	"fmt"
	"html/template"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/store"
)

type DigestData struct {
	Events         []EventData
	UnsubscribeURL string
	FrontendURL    string
}

type EventData struct {
	Title    string
	DateTime string
	Venue    string
	Category string // first category for display
	ImageURL string
	Price    string
	EventURL string
}

var emailTemplate = template.Must(template.New("digest").Parse(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="background-color:#0d5c63;padding:24px 32px;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">Your Weekly Event Digest</h1>
    <p style="margin:4px 0 0;color:#b2dfdb;font-size:14px;">{{len .Events}} events near you this week</p>
  </td></tr>
  <tr><td style="padding:24px 32px;">
    {{range .Events}}
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
    </table>
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

func RenderDigestEmail(events []store.Event, unsubscribeURL, frontendURL string) (string, error) {
	loc, _ := time.LoadLocation("America/New_York")

	var eventData []EventData
	for _, e := range events {
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

		eventData = append(eventData, ed)
	}

	data := DigestData{
		Events:         eventData,
		UnsubscribeURL: unsubscribeURL,
		FrontendURL:    frontendURL,
	}

	var buf bytes.Buffer
	if err := emailTemplate.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("render email template: %w", err)
	}
	return buf.String(), nil
}
