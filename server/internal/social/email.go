package social

import (
	"fmt"
	"html"
	"log"
	"strings"
	"time"
)

// emailGallery sends a simple gallery of the rendered cards with download links
// to the given recipient(s), for manual posting to social platforms.
// Best-effort: failures are logged, never fatal. No-op when Email or the
// recipient list is unconfigured.
func (g *Generator) emailGallery(recipients, heading string, start time.Time, results []Card) {
	if g.Email == nil || strings.TrimSpace(recipients) == "" {
		return
	}

	var cards strings.Builder
	for _, r := range results {
		cards.WriteString(fmt.Sprintf(`
<table width="100%%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:12px 16px;background:#0d5c63;color:#fff;font-size:15px;font-weight:600;">%s — %d events</td></tr>
  <tr><td style="padding:0;"><a href="%s"><img src="%s" width="100%%" style="display:block;max-width:540px;" alt="%s card"></a></td></tr>
  <tr><td style="padding:10px 16px;"><a href="%s" style="color:#0d5c63;font-size:13px;">Download PNG</a></td></tr>
</table>`,
			html.EscapeString(r.City), r.Count,
			html.EscapeString(r.URL), html.EscapeString(r.URL), html.EscapeString(r.City),
			html.EscapeString(r.URL)))
	}

	body := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="600" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:8px;padding:24px;">
  <tr><td>
    <h1 style="margin:0 0 4px;color:#0d5c63;font-size:20px;">%s — social cards ready</h1>
    <p style="margin:0 0 20px;color:#555;font-size:14px;">%d cards generated for the week of %s. Right-click to save, then post.</p>
    %s
  </td></tr>
</table>
</body></html>`, html.EscapeString(heading), len(results), start.Format("Jan 2, 2006"), cards.String())

	subject := fmt.Sprintf("%s — %d social cards ready", heading, len(results))
	for _, to := range strings.Split(recipients, ",") {
		to = strings.TrimSpace(to)
		if to == "" {
			continue
		}
		if err := g.Email.Send(to, subject, body); err != nil {
			log.Printf("Social: gallery email to %s failed: %v", to, err)
		}
	}
}
