package planner

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/notifier"
	"github.com/coltonsweeney/localevents/server/internal/recommend"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

const (
	maxItemsPerDay  = 5
	defaultRadiusMi = 10.0
	metersPerMile   = 1609.34

	// Ranking weights. Preference-vector affinity dominates, explicit/inferred
	// category match next, proximity as a tiebreaker. They need not sum to 1.
	weightPref = 0.60
	weightCat  = 0.25
	weightProx = 0.15
)

// Generator produces itineraries. The cron path (Run) needs Email; the on-demand
// path (Compute / ComputeAndStore, used by the HTTP handler) needs only Queries
// and optionally Recs. Email and Recs are therefore optional.
type Generator struct {
	Queries     *store.Queries
	Recs        *recommend.Service
	Email       *notifier.EmailSender
	FrontendURL string
	// APIURL is this server's public base URL (see notifier.Runner.APIURL).
	APIURL string
}

// weekWindow returns the ET 7-day plan window [start, start+7) and the location.
func weekWindow() (start, end time.Time, loc *time.Location) {
	loc, _ = time.LoadLocation("America/New_York")
	now := time.Now().In(loc)
	start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	end = start.AddDate(0, 0, 7)
	return start, end, loc
}

// Compute builds a transient itinerary for the given location/radius/categories.
// When userID is valid its preference vector personalizes ranking (and is
// refreshed if stale); pass an invalid pgtype.UUID for anonymous callers, in
// which case ranking falls back to category match + proximity.
func (g *Generator) Compute(ctx context.Context, userID pgtype.UUID, lat, lng, radiusMiles float64, categories []string) (WeeklyPlan, error) {
	startDate, endDate, loc := weekWindow()

	if userID.Valid {
		g.refreshVector(ctx, userID)
	}

	radiusMeters := radiusMiles * metersPerMile
	rows, err := g.Queries.ListPlannerEventsForUser(ctx, store.ListPlannerEventsForUserParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMeters,
		StartDate:    pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:      pgtype.Timestamptz{Time: endDate, Valid: true},
		UserID:       userID,
	})
	if err != nil {
		return WeeklyPlan{}, fmt.Errorf("query planner events: %w", err)
	}

	return buildItinerary(rows, categories, radiusMeters, startDate, loc, g.FrontendURL), nil
}

// ComputeAndStore computes a plan and, for a valid userID, persists it as the
// user's plan for the current week (overwriting any existing row). Anonymous
// callers get the same transient result without persistence.
func (g *Generator) ComputeAndStore(ctx context.Context, userID pgtype.UUID, lat, lng, radiusMiles float64, categories []string) (WeeklyPlan, error) {
	plan, err := g.Compute(ctx, userID, lat, lng, radiusMiles, categories)
	if err != nil {
		return plan, err
	}
	if !userID.Valid {
		return plan, nil
	}

	planJSON, err := json.Marshal(plan)
	if err != nil {
		return plan, fmt.Errorf("marshal plan: %w", err)
	}
	startDate, _, _ := weekWindow()
	if err := g.Queries.UpsertDailyPlan(ctx, store.UpsertDailyPlanParams{
		UserID: userID,
		WeekOf: pgtype.Date{Time: startDate, Valid: true},
		Plan:   planJSON,
	}); err != nil {
		return plan, fmt.Errorf("upsert daily plan: %w", err)
	}
	return plan, nil
}

// ResolveCategories returns explicit preferences if set, else the user's top
// inferred categories. Exposed for the on-demand handler.
func (g *Generator) ResolveCategories(ctx context.Context, userID pgtype.UUID, explicit []string) []string {
	return g.resolvePreferredCategories(ctx, userID, explicit)
}

// Run builds and persists a plan for every email subscriber. Intended to be
// called from the same Friday cron as the digest.
func (g *Generator) Run(ctx context.Context) {
	log.Println("Planner: starting weekly planner run")

	subs, err := g.Queries.ListEmailSubscribers(ctx)
	if err != nil {
		log.Printf("Planner: failed to list subscribers: %v", err)
		return
	}
	log.Printf("Planner: found %d subscribers", len(subs))

	for _, sub := range subs {
		// Dedup planner emails within 24h (matches the digest guard). When email
		// is unconfigured no log row is written, so the plan is simply
		// regenerated each run — harmless, since the upsert is idempotent.
		if g.recentlyRun(ctx, sub.ID) {
			continue
		}
		if err := g.generateForUser(ctx, sub); err != nil {
			log.Printf("Planner: failed for user %s: %v", uuidToString(sub.ID), err)
		}
	}

	log.Println("Planner: weekly planner run complete")
}

func (g *Generator) generateForUser(ctx context.Context, sub store.ListEmailSubscribersRow) error {
	if !sub.DefaultLatitude.Valid || !sub.DefaultLongitude.Valid {
		return nil // ListEmailSubscribers filters these out, but guard anyway.
	}

	radiusMiles := defaultRadiusMi
	if sub.DefaultRadiusMiles.Valid {
		radiusMiles = float64(sub.DefaultRadiusMiles.Int32)
	}

	categories := g.resolvePreferredCategories(ctx, sub.ID, sub.PreferredCategories)
	plan, err := g.ComputeAndStore(ctx, sub.ID, sub.DefaultLatitude.Float64, sub.DefaultLongitude.Float64, radiusMiles, categories)
	if err != nil {
		return err
	}

	// Email is best-effort, only when configured and the plan has content.
	if g.Email == nil || !sub.Email.Valid || totalItems(plan) == 0 {
		return nil
	}

	unsubscribeURL := fmt.Sprintf("%s/api/unsubscribe/%s", g.APIURL, uuidToString(sub.EmailUnsubscribeToken))
	html, err := RenderPlannerEmail(plan, unsubscribeURL, g.FrontendURL)
	if err != nil {
		return fmt.Errorf("render planner email: %w", err)
	}

	subject := "Your week ahead — your event itinerary"
	status := "sent"
	var errMsg pgtype.Text
	if err := g.Email.Send(sub.Email.String, subject, html); err != nil {
		status = "failed"
		errMsg = pgtype.Text{String: err.Error(), Valid: true}
		log.Printf("Planner: email send failed for %s: %v", sub.Email.String, err)
	}
	g.Queries.CreateNotificationLog(ctx, store.CreateNotificationLogParams{
		UserID:       sub.ID,
		Channel:      "planner",
		EventCount:   int32(totalItems(plan)),
		Status:       status,
		ErrorMessage: errMsg,
	})
	return nil
}

// refreshVector recomputes the user's preference vector when it's missing or
// marked stale and the user has enough signal. No-op if Recs is unset.
func (g *Generator) refreshVector(ctx context.Context, userID pgtype.UUID) {
	if g.Recs == nil {
		return
	}
	if err := g.Queries.EnsureUserPreferences(ctx, userID); err != nil {
		return
	}
	state, err := g.Queries.GetUserPreferencesState(ctx, userID)
	if err != nil {
		return
	}
	if state.SignalCount < int32(recommend.MinSignalsForRecs) {
		return
	}
	if state.HasVector && !state.NeedsRecompute {
		return
	}
	if _, err := g.Recs.RecomputeUser(ctx, uuid.UUID(userID.Bytes)); err != nil {
		log.Printf("Planner: recompute vector for %s: %v", uuidToString(userID), err)
	}
}

// buildItinerary groups events by ET day, ranks each day's events, keeps the
// top maxItemsPerDay, then orders the survivors chronologically. Input rows are
// already day- and time-ordered by the query.
func buildItinerary(rows []store.ListPlannerEventsForUserRow, preferred []string, radiusMeters float64, weekOf time.Time, loc *time.Location, frontendURL string) WeeklyPlan {
	prefSet := make(map[string]bool, len(preferred))
	for _, c := range preferred {
		prefSet[c] = true
	}

	type scored struct {
		row   store.ListPlannerEventsForUserRow
		score float64
	}

	buckets := make(map[string][]scored)
	var dayOrder []string

	for _, row := range rows {
		if !row.StartTime.Valid {
			continue
		}
		dateKey := row.StartTime.Time.In(loc).Format("2006-01-02")
		if _, ok := buckets[dateKey]; !ok {
			dayOrder = append(dayOrder, dateKey)
		}
		buckets[dateKey] = append(buckets[dateKey], scored{row: row, score: rankScore(row, prefSet, radiusMeters)})
	}

	days := make([]PlanDay, 0, len(dayOrder))
	for _, key := range dayOrder {
		items := buckets[key]
		// Rank by score to pick the day's shortlist...
		sort.SliceStable(items, func(i, j int) bool { return items[i].score > items[j].score })
		if len(items) > maxItemsPerDay {
			items = items[:maxItemsPerDay]
		}
		// ...then present them chronologically.
		sort.SliceStable(items, func(i, j int) bool {
			return items[i].row.StartTime.Time.Before(items[j].row.StartTime.Time)
		})

		planItems := make([]PlanItem, 0, len(items))
		for _, it := range items {
			planItems = append(planItems, toPlanItem(it.row, loc, frontendURL))
		}
		dayStart, _ := time.ParseInLocation("2006-01-02", key, loc)
		days = append(days, PlanDay{
			Date:    key,
			Weekday: dayStart.Format("Monday, January 2"),
			Items:   planItems,
		})
	}

	return WeeklyPlan{WeekOf: weekOf.Format("2006-01-02"), Days: days}
}

// rankScore blends preference-vector affinity, category match, and proximity.
// pref_score is NULL (and thus contributes 0) for cold-start users, letting
// category and proximity drive their ranking.
func rankScore(row store.ListPlannerEventsForUserRow, prefSet map[string]bool, radiusMeters float64) float64 {
	var normPref float64
	if v, ok := row.PrefScore.(float64); ok {
		normPref = (v + 1) / 2 // cosine [-1,1] -> [0,1]
	}

	var catMatch float64
	for _, c := range row.Categories {
		if prefSet[c] {
			catMatch = 1
			break
		}
	}

	prox := 0.0
	if radiusMeters > 0 {
		prox = 1 - row.DistanceMeters/radiusMeters
		prox = math.Max(0, math.Min(1, prox))
	}

	return weightPref*normPref + weightCat*catMatch + weightProx*prox
}

func toPlanItem(row store.ListPlannerEventsForUserRow, loc *time.Location, frontendURL string) PlanItem {
	item := PlanItem{
		EventID:       uuidToString(row.ID),
		Title:         row.Title,
		EventURL:      fmt.Sprintf("%s/events/%s", frontendURL, uuidToString(row.ID)),
		DistanceMiles: math.Round(row.DistanceMeters/metersPerMile*10) / 10,
	}
	if row.StartTime.Valid {
		t := row.StartTime.Time.In(loc)
		item.StartTime = t.Format(time.RFC3339)
		item.TimeLabel = t.Format("3:04 PM")
	}
	if row.VenueName.Valid {
		item.VenueName = row.VenueName.String
	}
	if len(row.Categories) > 0 {
		item.Category = row.Categories[0]
	}
	if row.ImageUrl.Valid {
		item.ImageURL = row.ImageUrl.String
	}
	return item
}

// resolvePreferredCategories returns explicit preferences if set, else infers
// the top categories from the user's saved events. Mirrors the digest logic.
func (g *Generator) resolvePreferredCategories(ctx context.Context, userID pgtype.UUID, explicit []string) []string {
	if len(explicit) > 0 {
		return explicit
	}
	if !userID.Valid {
		return nil
	}
	affinities, err := g.Queries.GetUserCategoryAffinities(ctx, userID)
	if err != nil || len(affinities) == 0 {
		return nil
	}
	cats := make([]string, 0, 3)
	for i, a := range affinities {
		if i >= 3 {
			break
		}
		cats = append(cats, a.Category)
	}
	return cats
}

func (g *Generator) recentlyRun(ctx context.Context, userID pgtype.UUID) bool {
	last, err := g.Queries.GetLastNotificationSent(ctx, store.GetLastNotificationSentParams{
		UserID:  userID,
		Channel: "planner",
	})
	if err != nil {
		return false
	}
	return time.Since(last.SentAt.Time) < 24*time.Hour
}

func uuidToString(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	return uuid.UUID(id.Bytes).String()
}
