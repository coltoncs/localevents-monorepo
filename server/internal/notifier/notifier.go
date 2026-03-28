package notifier

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/billing"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type Runner struct {
	Queries        *store.Queries
	Email          *EmailSender
	SMS            *SMSSender
	FrontendURL    string
	ClerkSecretKey string
}

func (r *Runner) Run(ctx context.Context) {
	loc, _ := time.LoadLocation("America/New_York")
	now := time.Now().In(loc)
	startDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	endDate := startDate.AddDate(0, 0, 7)

	log.Println("Digest: starting weekly digest run")

	if r.Email != nil {
		r.sendEmailDigests(ctx, startDate, endDate)
	}
	if r.SMS != nil {
		r.sendSMSDigests(ctx, startDate, endDate)
	}

	log.Println("Digest: weekly digest run complete")
}

// RunForUser sends an on-demand email digest to a single user.
func (r *Runner) RunForUser(ctx context.Context, userID pgtype.UUID) error {
	if r.Email == nil {
		return fmt.Errorf("email not configured")
	}

	loc, _ := time.LoadLocation("America/New_York")
	now := time.Now().In(loc)
	startDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	endDate := startDate.AddDate(0, 0, 7)

	sub, err := r.Queries.GetEmailSubscriberByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found or email not enabled: %w", err)
	}

	radiusMeters := float64(10) * 1609.34
	if sub.DefaultRadiusMiles.Valid {
		radiusMeters = float64(sub.DefaultRadiusMiles.Int32) * 1609.34
	}

	events, err := r.Queries.ListUpcomingEventsForDigest(ctx, store.ListUpcomingEventsForDigestParams{
		Lng:          sub.DefaultLongitude.Float64,
		Lat:          sub.DefaultLatitude.Float64,
		RadiusMeters: radiusMeters,
		StartDate:    pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:      pgtype.Timestamptz{Time: endDate, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("querying events: %w", err)
	}

	savedEvents, err := r.Queries.ListSavedEventsForDigest(ctx, store.ListSavedEventsForDigestParams{
		UserID:    sub.ID,
		StartDate: pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:   pgtype.Timestamptz{Time: endDate, Valid: true},
	})
	if err != nil {
		savedEvents = nil
	}

	if len(events) == 0 && len(savedEvents) == 0 {
		return fmt.Errorf("no events found for this week")
	}

	categories := r.resolvePreferredCategories(ctx, sub.ID, sub.PreferredCategories)

	unsubscribeURL := fmt.Sprintf("%s/api/unsubscribe/%s", r.FrontendURL, uuidToString(sub.EmailUnsubscribeToken))
	html, err := RenderDigestEmail(events, savedEvents, categories, unsubscribeURL, r.FrontendURL)
	if err != nil {
		return fmt.Errorf("rendering email: %w", err)
	}

	subject := fmt.Sprintf("%d events near you this week!", len(events)+len(savedEvents))
	if err := r.Email.Send(sub.Email.String, subject, html); err != nil {
		return fmt.Errorf("sending email: %w", err)
	}

	r.Queries.CreateNotificationLog(ctx, store.CreateNotificationLogParams{
		UserID:     sub.ID,
		Channel:    "email",
		EventCount: int32(len(events) + len(savedEvents)),
		Status:     "sent",
	})

	return nil
}

func (r *Runner) sendEmailDigests(ctx context.Context, startDate, endDate time.Time) {
	subscribers, err := r.Queries.ListEmailSubscribers(ctx)
	if err != nil {
		log.Printf("Digest: failed to list email subscribers: %v", err)
		return
	}

	log.Printf("Digest: found %d email subscribers", len(subscribers))

	for _, sub := range subscribers {
		// Check for double-send within 24 hours
		if r.recentlySent(ctx, sub.ID, "email") {
			continue
		}

		radiusMeters := float64(10) * 1609.34 // default 10 miles
		if sub.DefaultRadiusMiles.Valid {
			radiusMeters = float64(sub.DefaultRadiusMiles.Int32) * 1609.34
		}

		events, err := r.Queries.ListUpcomingEventsForDigest(ctx, store.ListUpcomingEventsForDigestParams{
			Lng:          sub.DefaultLongitude.Float64,
			Lat:          sub.DefaultLatitude.Float64,
			RadiusMeters: radiusMeters,
			StartDate:    pgtype.Timestamptz{Time: startDate, Valid: true},
			EndDate:      pgtype.Timestamptz{Time: endDate, Valid: true},
		})
		if err != nil {
			log.Printf("Digest: failed to query events for user %s: %v", uuidToString(sub.ID), err)
			continue
		}

		// Query saved events within the digest window.
		savedEvents, err := r.Queries.ListSavedEventsForDigest(ctx, store.ListSavedEventsForDigestParams{
			UserID:    sub.ID,
			StartDate: pgtype.Timestamptz{Time: startDate, Valid: true},
			EndDate:   pgtype.Timestamptz{Time: endDate, Valid: true},
		})
		if err != nil {
			log.Printf("Digest: failed to query saved events for user %s: %v", uuidToString(sub.ID), err)
			savedEvents = nil
		}

		if len(events) == 0 && len(savedEvents) == 0 {
			continue
		}

		categories := r.resolvePreferredCategories(ctx, sub.ID, sub.PreferredCategories)

		unsubscribeURL := fmt.Sprintf("%s/api/unsubscribe/%s", r.FrontendURL, uuidToString(sub.EmailUnsubscribeToken))
		html, err := RenderDigestEmail(events, savedEvents, categories, unsubscribeURL, r.FrontendURL)
		if err != nil {
			log.Printf("Digest: failed to render email for user %s: %v", uuidToString(sub.ID), err)
			continue
		}

		subject := fmt.Sprintf("%d events near you this week!", len(events))
		err = r.Email.Send(sub.Email.String, subject, html)
		status := "sent"
		var errMsg pgtype.Text
		if err != nil {
			status = "failed"
			errMsg = pgtype.Text{String: err.Error(), Valid: true}
			log.Printf("Digest: email send failed for %s: %v", sub.Email.String, err)
		}

		r.Queries.CreateNotificationLog(ctx, store.CreateNotificationLogParams{
			UserID:       sub.ID,
			Channel:      "email",
			EventCount:   int32(len(events)),
			Status:       status,
			ErrorMessage: errMsg,
		})
	}
}

func (r *Runner) sendSMSDigests(ctx context.Context, startDate, endDate time.Time) {
	subscribers, err := r.Queries.ListSMSSubscribers(ctx)
	if err != nil {
		log.Printf("Digest: failed to list SMS subscribers: %v", err)
		return
	}

	log.Printf("Digest: found %d SMS subscribers", len(subscribers))

	for _, sub := range subscribers {
		if r.recentlySent(ctx, sub.ID, "sms") {
			continue
		}

		// SMS requires active subscription
		if r.ClerkSecretKey != "" {
			active, err := billing.HasActiveSubscription(r.ClerkSecretKey, sub.ClerkID)
			if err != nil {
				log.Printf("Digest: failed to check subscription for user %s: %v", uuidToString(sub.ID), err)
				continue
			}
			if !active {
				log.Printf("Digest: skipping SMS for user %s (no active subscription)", uuidToString(sub.ID))
				continue
			}
		}

		radiusMeters := float64(10) * 1609.34
		if sub.DefaultRadiusMiles.Valid {
			radiusMeters = float64(sub.DefaultRadiusMiles.Int32) * 1609.34
		}

		events, err := r.Queries.ListUpcomingEventsForDigest(ctx, store.ListUpcomingEventsForDigestParams{
			Lng:          sub.DefaultLongitude.Float64,
			Lat:          sub.DefaultLatitude.Float64,
			RadiusMeters: radiusMeters,
			StartDate:    pgtype.Timestamptz{Time: startDate, Valid: true},
			EndDate:      pgtype.Timestamptz{Time: endDate, Valid: true},
		})
		if err != nil {
			log.Printf("Digest: failed to query events for user %s: %v", uuidToString(sub.ID), err)
			continue
		}

		if len(events) == 0 {
			continue
		}

		categories := r.resolvePreferredCategories(ctx, sub.ID, sub.PreferredCategories)
		events = sortByPreferredCategories(events, categories)

		body := composeSMSBody(events, r.FrontendURL)
		err = r.SMS.Send(sub.PhoneNumber.String, body)
		status := "sent"
		var errMsg pgtype.Text
		if err != nil {
			status = "failed"
			errMsg = pgtype.Text{String: err.Error(), Valid: true}
			log.Printf("Digest: SMS send failed for %s: %v", sub.PhoneNumber.String, err)
		}

		r.Queries.CreateNotificationLog(ctx, store.CreateNotificationLogParams{
			UserID:       sub.ID,
			Channel:      "sms",
			EventCount:   int32(len(events)),
			Status:       status,
			ErrorMessage: errMsg,
		})
	}
}

func composeSMSBody(events []store.Event, frontendURL string) string {
	count := len(events)
	var names []string
	for i, e := range events {
		if i >= 3 {
			break
		}
		names = append(names, e.Title)
	}

	msg := fmt.Sprintf("%d events near you this week! %s.", count, strings.Join(names, ", "))
	if count > 3 {
		msg += fmt.Sprintf(" +%d more.", count-3)
	}
	msg += fmt.Sprintf(" See all: %s", frontendURL)
	msg += " Reply STOP to unsubscribe"
	return msg
}

func (r *Runner) recentlySent(ctx context.Context, userID pgtype.UUID, channel string) bool {
	last, err := r.Queries.GetLastNotificationSent(ctx, store.GetLastNotificationSentParams{
		UserID:  userID,
		Channel: channel,
	})
	if err != nil {
		return false // no record found, ok to send
	}
	return time.Since(last.SentAt.Time) < 24*time.Hour
}

func uuidToString(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	return uuid.UUID(id.Bytes).String()
}

// sortByPreferredCategories moves events matching any preferred category to the
// top while preserving relative order within each group.
func sortByPreferredCategories(events []store.Event, preferred []string) []store.Event {
	if len(preferred) == 0 {
		return events
	}
	prefSet := make(map[string]bool, len(preferred))
	for _, c := range preferred {
		prefSet[c] = true
	}
	sorted := make([]store.Event, len(events))
	copy(sorted, events)
	slices.SortStableFunc(sorted, func(a, b store.Event) int {
		aMatch := hasPreferred(a.Categories, prefSet)
		bMatch := hasPreferred(b.Categories, prefSet)
		if aMatch == bMatch {
			return 0
		}
		if aMatch {
			return -1
		}
		return 1
	})
	return sorted
}

func hasPreferred(categories []string, prefSet map[string]bool) bool {
	for _, c := range categories {
		if prefSet[c] {
			return true
		}
	}
	return false
}

// resolvePreferredCategories returns explicit preferences if set, otherwise
// infers top categories from the user's saved events.
func (r *Runner) resolvePreferredCategories(ctx context.Context, userID pgtype.UUID, explicit []string) []string {
	if len(explicit) > 0 {
		return explicit
	}
	affinities, err := r.Queries.GetUserCategoryAffinities(ctx, userID)
	if err != nil || len(affinities) == 0 {
		return nil
	}
	// Use top 3 inferred categories
	cats := make([]string, 0, 3)
	for i, a := range affinities {
		if i >= 3 {
			break
		}
		cats = append(cats, a.Category)
	}
	return cats
}

func formatNumeric(n pgtype.Numeric) string {
	if !n.Valid {
		return ""
	}
	// Convert to float for display
	f, _ := new(big.Float).SetInt(n.Int).Float64()
	for i := int32(0); i < -n.Exp; i++ {
		f /= 10
	}
	if f == float64(int64(f)) {
		return fmt.Sprintf("$%.0f", f)
	}
	return fmt.Sprintf("$%.2f", f)
}
