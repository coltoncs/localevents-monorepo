package scraper

import (
	"html"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Helpers shared by the single-venue scrapers (Pinhook, Motorco), which read
// a venue's own calendar rather than a city-wide listings API.

// easternTZ is the time zone every Triangle venue lists its shows in.
var easternTZ = func() *time.Location {
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		return time.UTC
	}
	return loc
}()

// venueTicket is one ticket tier scraped from a venue's ticket page.
type venueTicket struct {
	Price float64
}

// venuePriceRange turns ticket tiers into price bounds. All-$0 tiers mean the
// show is explicitly free; no tiers at all means the price is unknown.
func venuePriceRange(ts []venueTicket) (priceMin, priceMax *float64, isFree bool) {
	if len(ts) == 0 {
		return nil, nil, false
	}
	lo, hi := ts[0].Price, ts[0].Price
	for _, t := range ts[1:] {
		lo = min(lo, t.Price)
		hi = max(hi, t.Price)
	}
	if hi == 0 {
		return nil, nil, true
	}
	return &lo, &hi, false
}

// parallelEach calls fn(i) for i in [0, n) with at most limit calls in flight.
func parallelEach(n, limit int, fn func(i int)) {
	sem := make(chan struct{}, max(limit, 1))
	var wg sync.WaitGroup
	for i := range n {
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			fn(i)
		}()
	}
	wg.Wait()
}

var (
	vpCommentRe  = regexp.MustCompile(`(?s)<!--.*?-->`)
	vpSourceWSRe = regexp.MustCompile(`[\r\n\t]+`)
	vpBlockTagRe = regexp.MustCompile(`(?i)</p>|<br\s*/?>|</li>|</h[1-6]>|</div>`)
	vpLiRe       = regexp.MustCompile(`(?i)<li[^>]*>`)
	vpAnyTagRe   = regexp.MustCompile(`<[^>]+>`)
	vpBlankRe    = regexp.MustCompile(`\n{3,}`)
)

// venueHTMLToText converts a rich-text HTML fragment into plain text, keeping
// paragraph and line breaks.
func venueHTMLToText(s string) string {
	s = vpCommentRe.ReplaceAllString(s, "")
	s = vpSourceWSRe.ReplaceAllString(s, " ") // source newlines are just spaces in HTML
	s = vpBlockTagRe.ReplaceAllString(s, "\n")
	s = vpLiRe.ReplaceAllString(s, "• ")
	s = vpAnyTagRe.ReplaceAllString(s, "")
	s = html.UnescapeString(s)
	s = strings.ReplaceAll(s, " ", " ")
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		lines[i] = strings.TrimSpace(l)
	}
	s = strings.Join(lines, "\n")
	s = vpBlankRe.ReplaceAllString(s, "\n\n")
	return strings.TrimSpace(s)
}

// withSupport prepends a "with <openers>" line to a description, keeping the
// event title as just the headliner so it dedups against aggregator listings.
func withSupport(support, descHTML string) string {
	support = strings.TrimSpace(support)
	if support == "" {
		return descHTML
	}
	return "<p>with " + html.EscapeString(support) + "</p>" + descHTML
}

// venueDescriptionHTML re-renders a venue's rich-text description as minimal
// HTML (<p> and <br> only), since the event page renders descriptions as HTML.
// Angle brackets in the text are dropped rather than escaped: the Runner
// unescapes entities in descriptions, which would turn "&lt;" back into "<".
func venueDescriptionHTML(raw string) string {
	text := strings.NewReplacer("<", "", ">", "").Replace(venueHTMLToText(raw))
	if text == "" {
		return ""
	}
	var b strings.Builder
	for _, para := range strings.Split(text, "\n\n") {
		b.WriteString("<p>")
		b.WriteString(strings.ReplaceAll(para, "\n", "<br>"))
		b.WriteString("</p>")
	}
	return b.String()
}
