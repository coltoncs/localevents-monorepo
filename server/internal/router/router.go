package router

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/coltonsweeney/localevents/server/internal/config"
	"github.com/coltonsweeney/localevents/server/internal/handler"
	"github.com/coltonsweeney/localevents/server/internal/metrics"
	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/notifier"
	"github.com/coltonsweeney/localevents/server/internal/recommend"
	"github.com/coltonsweeney/localevents/server/internal/storage"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

// redirectLegacyPath rewrites the URL prefix and replies with a 301.
// Used to forward old /foods and /beverages paths to the unified /places routes.
func redirectLegacyPath(w http.ResponseWriter, r *http.Request, oldPrefix, newPrefix string) {
	target := newPrefix + strings.TrimPrefix(r.URL.Path, oldPrefix)
	if r.URL.RawQuery != "" {
		target += "?" + r.URL.RawQuery
	}
	http.Redirect(w, r, target, http.StatusMovedPermanently)
}

func New(queries *store.Queries, pool *pgxpool.Pool, cfg *config.Config, digestRunner *notifier.Runner, r2 *storage.R2Client, recs *recommend.Service) *chi.Mux {
	r := chi.NewRouter()

	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RealIP)
	r.Use(middleware.CORS(cfg.CORSOrigins))
	r.Use(metrics.Middleware)

	r.Handle("/metrics", promhttp.Handler())

	eventHandler := handler.NewEventHandler(queries, pool, r2)
	venueHandler := handler.NewVenueHandler(queries)
	userHandler := handler.NewUserHandler(queries)
	appHandler := handler.NewApplicationHandler(queries)
	imageHandler := handler.NewImageHandler(queries, r2)
	sitemapHandler := handler.NewSitemapHandler(queries)
	notificationHandler := handler.NewNotificationHandler(queries, cfg.FrontendURL, cfg.ClerkSecretKey, digestRunner)
	digestHandler := handler.NewDigestHandler(digestRunner)
	suggestionHandler := handler.NewSuggestionHandler(queries)
	smsWebhookHandler := handler.NewSMSWebhookHandler(queries)
	placeHandler := handler.NewPlaceHandler(queries)
	adminHandler := handler.NewAdminHandler(queries)
	recsHandler := handler.NewRecommendationHandler(queries, recs)

	redirectFoods := func(w http.ResponseWriter, r *http.Request) {
		redirectLegacyPath(w, r, "/api/foods", "/api/places")
	}
	redirectBeverages := func(w http.ResponseWriter, r *http.Request) {
		redirectLegacyPath(w, r, "/api/beverages", "/api/places")
	}

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", handler.HealthCheck)
		r.Get("/sitemap.xml", sitemapHandler.Sitemap)
		r.Get("/unsubscribe/{token}", notificationHandler.Unsubscribe)
		r.Post("/sms/incoming", smsWebhookHandler.Incoming)

		// Public routes with optional auth
		r.Group(func(r chi.Router) {
			r.Use(middleware.OptionalAuth())
			r.Get("/events", eventHandler.List)
			r.Get("/events/map", eventHandler.ListMap)
			r.Get("/events/series/{seriesId}", eventHandler.ListSeriesEvents)
			r.Get("/events/{id}", eventHandler.Get)
			r.Get("/events/{id}/save-count", eventHandler.SaveCount)
			r.Get("/venues", venueHandler.List)
			r.Get("/venues/{id}", venueHandler.Get)
			r.Get("/places", placeHandler.List)
			r.Get("/places/{id}", placeHandler.Get)
			r.Get("/places/{id}/checkin-counts", placeHandler.CheckInCounts)
			// Anyone may submit a suggestion; unauthenticated submissions are
			// rate-limited per IP to blunt spam and still land in the review queue.
			r.With(middleware.RateLimit(10, time.Hour)).Post("/suggestions", suggestionHandler.Create)
		})

		// Legacy /foods and /beverages paths -> 301 redirects to /places
		r.Get("/foods", redirectFoods)
		r.Get("/foods/{id}", redirectFoods)
		r.Get("/foods/{id}/checkin-counts", redirectFoods)
		r.Get("/beverages", redirectBeverages)
		r.Get("/beverages/{id}", redirectBeverages)
		r.Get("/beverages/{id}/checkin-counts", redirectBeverages)

		// Authenticated routes (any signed-in user)
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth())
			r.Get("/me", userHandler.GetMe)
			r.Put("/me", userHandler.UpdateMe)
			r.Get("/me/events", userHandler.ListMyEvents)
			r.Get("/me/saved", userHandler.ListSaved)
			r.Get("/me/place-checkins", userHandler.ListMyPlaceCheckIns)
			r.Post("/me/saved/{eventId}", userHandler.SaveEvent)
			r.Delete("/me/saved/{eventId}", userHandler.UnsaveEvent)
			r.Post("/author-applications", appHandler.Submit)
			r.Get("/me/application", appHandler.GetMyApplication)
			r.Get("/me/notifications", notificationHandler.GetPreferences)
			r.Put("/me/notifications", notificationHandler.UpdatePreferences)
			r.Post("/me/notifications/trigger-digest", notificationHandler.TriggerDigest)
			r.Get("/me/recommendations", recsHandler.List)
			r.Post("/me/event-views/{eventId}", recsHandler.RecordView)
			r.Post("/images/presign", imageHandler.Presign)
			r.Post("/images/confirm", imageHandler.Confirm)
			r.Get("/images", imageHandler.List)
			r.Delete("/images/{id}", imageHandler.Delete)
			r.Post("/places/{id}/checkins", placeHandler.CheckIn)
			r.Get("/places/{id}/my-checkin-status", placeHandler.MyCheckInStatus)
		})

		// Author/Admin routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth())
			r.Use(middleware.RequireRole(middleware.RoleAuthor, middleware.RoleAdmin))
			r.Post("/events", eventHandler.Create)
			r.Post("/events/series", eventHandler.CreateSeries)
			r.Put("/events/series/{seriesId}", eventHandler.UpdateSeries)
			r.Put("/events/{id}", eventHandler.Update)
			r.Delete("/events/{id}", eventHandler.Delete)
			r.Post("/venues", venueHandler.Create)
			r.Put("/venues/{id}", venueHandler.Update)
			r.Get("/me/suggestions", suggestionHandler.ListMyEventSuggestions)
			r.Post("/suggestions/{id}/approve", suggestionHandler.Approve)
			r.Post("/suggestions/{id}/reject", suggestionHandler.Reject)
		})

		// Admin routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth())
			r.Use(middleware.RequireRole(middleware.RoleAdmin))
			r.Post("/places", placeHandler.Create)
			r.Put("/places/{id}", placeHandler.Update)
			r.Delete("/places/{id}", placeHandler.Delete)
			r.Get("/admin/applications", appHandler.ListPending)
			r.Post("/admin/applications/{id}/approve", appHandler.Approve)
			r.Post("/admin/applications/{id}/reject", appHandler.Reject)
			r.Post("/admin/digest/trigger", digestHandler.Trigger)
			r.Get("/admin/suggestions", suggestionHandler.ListPending)
			r.Get("/admin/stats", adminHandler.GetStats)
		})
	})

	return r
}
