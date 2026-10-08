package scraper

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/metrics"
)

const (
	// pinhookAccountID is The Pinhook's VenuePilot account (from window.venuepilotSettings).
	pinhookAccountID  = 2820
	pinhookGraphQLURL = "https://www.venuepilot.co/graphql"
)

// Pinhook implements EventSource for The Pinhook (Durham, NC).
//
// thepinhook.com/#/events is a VenuePilot widget embedded in Squarespace. The
// widget pulls its data from VenuePilot's public GraphQL API, so we query that
// directly. Ticket prices are not in the GraphQL response; they come from the
// JSON state embedded in each ticket page.
type Pinhook struct {
	Client      *http.Client
	Concurrency int // parallel ticket-page fetches
}

// NewPinhook creates a new Pinhook source.
func NewPinhook() *Pinhook {
	return &Pinhook{
		Client:      metrics.NewInstrumentedClient("pinhook", 30*time.Second),
		Concurrency: 4,
	}
}

func (p *Pinhook) Name() string { return "pinhook" }

// FetchEvents only runs for the Durham location to avoid duplicate work.
func (p *Pinhook) FetchEvents(ctx context.Context, loc Location) ([]RawEvent, error) {
	if loc.Name != "Durham" {
		return nil, nil
	}

	gqlEvents, err := p.fetchEvents(ctx, time.Now().In(easternTZ).Format("2006-01-02"))
	if err != nil {
		return nil, err
	}

	var evs []RawEvent
	for _, ge := range gqlEvents {
		if ev, ok := mapPinhookEvent(ge); ok {
			evs = append(evs, ev)
		}
	}

	// A failed ticket page only costs that event its price, not the event.
	parallelEach(len(evs), p.Concurrency, func(i int) {
		if evs[i].TicketURL == "" || ctx.Err() != nil {
			return
		}
		if err := p.fillTickets(ctx, &evs[i]); err != nil {
			log.Printf("[pinhook] %s: %v", evs[i].ExternalID, err)
		}
	})

	return evs, ctx.Err()
}

// ---- GraphQL event list ----

const pinhookEventsQuery = `query ($accountIds: [Int!]!, $startDate: String!, $limit: Int) {
  publicEvents(accountIds: $accountIds, startDate: $startDate, limit: $limit) {
    id name date doorTime startTime support description ticketsUrl tags
    announceImages { highlighted versions { cover { src } thumb { src } } }
  }
}`

type pinhookGQLEvent struct {
	ID          int      `json:"id"`
	Name        string   `json:"name"`
	Date        string   `json:"date"`
	DoorTime    string   `json:"doorTime"`
	StartTime   string   `json:"startTime"`
	Support     string   `json:"support"`
	Description string   `json:"description"`
	TicketsURL  string   `json:"ticketsUrl"`
	Tags        []string `json:"tags"`
	Images      []struct {
		Highlighted bool `json:"highlighted"`
		Versions    struct {
			Cover struct{ Src string } `json:"cover"`
			Thumb struct{ Src string } `json:"thumb"`
		} `json:"versions"`
	} `json:"announceImages"`
}

func (p *Pinhook) fetchEvents(ctx context.Context, startDate string) ([]pinhookGQLEvent, error) {
	body, _ := json.Marshal(map[string]any{
		"query": pinhookEventsQuery,
		"variables": map[string]any{
			"accountIds": []int{pinhookAccountID},
			"startDate":  startDate,
			"limit":      500,
		},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, pinhookGraphQLURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("events query: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("events query: HTTP %d", resp.StatusCode)
	}

	var out struct {
		Data struct {
			PublicEvents []pinhookGQLEvent `json:"publicEvents"`
		} `json:"data"`
		Errors []struct{ Message string } `json:"errors"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("events query: decode: %w", err)
	}
	if len(out.Errors) > 0 {
		return nil, fmt.Errorf("events query: %s", out.Errors[0].Message)
	}
	return out.Data.PublicEvents, nil
}

// mapPinhookEvent converts a VenuePilot event. It reports false for events
// without a parseable date.
func mapPinhookEvent(ge pinhookGQLEvent) (RawEvent, bool) {
	t := hhmm(ge.StartTime)
	if t == "" {
		t = hhmm(ge.DoorTime)
	}
	if t == "" {
		t = "00:00"
	}
	start, err := time.ParseInLocation("2006-01-02 15:04", ge.Date+" "+t, easternTZ)
	if err != nil {
		return RawEvent{}, false
	}

	// VenuePilot tags are free-form; the Pinhook prefixes them with "ALL"
	// (e.g. "ALLindie", "ALLcommunity"). Stripped, they double as genres and
	// as category hints ("community", "film"). Shows with a recognizable
	// genre are music; everything else at a bar venue is at least nightlife.
	var tags []string
	for _, tag := range ge.Tags {
		tags = append(tags, strings.ToLower(strings.TrimPrefix(tag, "ALL")))
	}
	categories := []string{"Nightlife"}
	if len(NormalizeGenres(tags)) > 0 {
		categories = []string{"Music"}
	}

	return RawEvent{
		ExternalID:  "pinhook-" + strconv.Itoa(ge.ID),
		Source:      "pinhook",
		Title:       strings.TrimSpace(ge.Name),
		Description: venueDescriptionHTML(withSupport(ge.Support, ge.Description)),
		VenueName:   "The Pinhook",
		Address:     "117 W Main St",
		City:        "Durham",
		State:       "NC",
		Zip:         "27701",
		Latitude:    35.99606,
		Longitude:   -78.90191,
		StartTime:   start.UTC(),
		Categories:  append(categories, tags...),
		Genre:       tags,
		ImageURL:    pinhookImage(ge),
		TicketURL:   strings.TrimSpace(ge.TicketsURL),
	}, true
}

// pinhookImage prefers the highlighted image, then the first one, and the
// cover version over the thumbnail.
func pinhookImage(ge pinhookGQLEvent) string {
	for pass := range 2 {
		for _, img := range ge.Images {
			if pass == 0 && !img.Highlighted {
				continue
			}
			if img.Versions.Cover.Src != "" {
				return img.Versions.Cover.Src
			}
			if img.Versions.Thumb.Src != "" {
				return img.Versions.Thumb.Src
			}
		}
	}
	return ""
}

// ---- Ticket page ----

var (
	pinhookPageContextRe = regexp.MustCompile(`(?s)<script id="vike_pageContext" type="application/json"[^>]*>(.*?)</script>`)
	pinhookOGImageRe     = regexp.MustCompile(`<meta property="og:image" content="([^"]+)"`)
)

type pinhookTicketPage struct {
	PiniaInitialState struct {
		Checkout struct {
			Tickets []struct {
				TicketType string `json:"ticketType"`
				Breakdown  struct {
					Price lenientFloat `json:"price"`
				} `json:"breakdown"`
			} `json:"tickets"`
		} `json:"checkout"`
	} `json:"_piniaInitialState"`
}

// fillTickets loads the ticket page, records its final URL, and fills in the
// price range (face value, before fees).
func (p *Pinhook) fillTickets(ctx context.Context, ev *RawEvent) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ev.TicketURL, nil)
	if err != nil {
		return err
	}
	resp, err := p.Client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// t.venuepilot.com short links redirect to tickets.venuepilot.com.
	ev.TicketURL = resp.Request.URL.String()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ticket page: HTTP %d", resp.StatusCode)
	}
	if !strings.HasSuffix(resp.Request.URL.Hostname(), "venuepilot.com") {
		// External ticket link (e.g. a signup form). Keep the URL, skip prices.
		return nil
	}

	page, err := io.ReadAll(io.LimitReader(resp.Body, 5<<20))
	if err != nil {
		return err
	}

	if ev.ImageURL == "" {
		if m := pinhookOGImageRe.FindSubmatch(page); m != nil {
			ev.ImageURL = html.UnescapeString(string(m[1]))
		}
	}

	m := pinhookPageContextRe.FindSubmatch(page)
	if m == nil {
		return errors.New("ticket page: embedded page context not found")
	}
	var st pinhookTicketPage
	if err := json.Unmarshal(m[1], &st); err != nil {
		return fmt.Errorf("ticket page: decode: %w", err)
	}

	var tickets []venueTicket
	for _, t := range st.PiniaInitialState.Checkout.Tickets {
		if t.TicketType != "" && t.TicketType != "ticket" {
			continue // donations / add-ons
		}
		tickets = append(tickets, venueTicket{Price: float64(t.Breakdown.Price)})
	}
	ev.PriceMin, ev.PriceMax, ev.IsFree = venuePriceRange(tickets)
	return nil
}

// lenientFloat decodes a JSON number and tolerates the "!undefined"-style
// string sentinels the ticket page's serializer emits for missing values.
type lenientFloat float64

func (f *lenientFloat) UnmarshalJSON(b []byte) error {
	var n float64
	if err := json.Unmarshal(b, &n); err == nil {
		*f = lenientFloat(n)
	}
	return nil
}

// hhmm turns "19:30:00" into "19:30".
func hhmm(t string) string {
	if len(t) >= 5 {
		return t[:5]
	}
	return t
}
