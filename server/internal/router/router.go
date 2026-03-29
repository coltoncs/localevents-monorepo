package router

import (
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"

	"github.com/coltonsweeney/localevents/server/internal/config"
	"github.com/coltonsweeney/localevents/server/internal/handler"
	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/notifier"
	"github.com/coltonsweeney/localevents/server/internal/storage"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

func New(queries *store.Queries, cfg *config.Config, digestRunner *notifier.Runner, r2 *storage.R2Client) *chi.Mux {
	r := chi.NewRouter()

	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RealIP)
	r.Use(middleware.CORS(cfg.CORSOrigins))

	eventHandler := handler.NewEventHandler(queries, r2)
	venueHandler := handler.NewVenueHandler(queries)
	userHandler := handler.NewUserHandler(queries)
	appHandler := handler.NewApplicationHandler(queries)
	imageHandler := handler.NewImageHandler(queries, r2)
	sitemapHandler := handler.NewSitemapHandler(queries)
	notificationHandler := handler.NewNotificationHandler(queries, cfg.FrontendURL, cfg.ClerkSecretKey, digestRunner)
	digestHandler := handler.NewDigestHandler(digestRunner)
	suggestionHandler := handler.NewSuggestionHandler(queries)
	smsWebhookHandler := handler.NewSMSWebhookHandler(queries)
	adminHandler := handler.NewAdminHandler(queries)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", handler.HealthCheck)
		r.Get("/sitemap.xml", sitemapHandler.Sitemap)
		r.Get("/unsubscribe/{token}", notificationHandler.Unsubscribe)
		r.Post("/sms/incoming", smsWebhookHandler.Incoming)

		// Public routes with optional auth
		r.Group(func(r chi.Router) {
			r.Use(middleware.OptionalAuth())
			r.Get("/events", eventHandler.List)
			r.Get("/events/series/{seriesId}", eventHandler.ListSeriesEvents)
			r.Get("/events/{id}", eventHandler.Get)
			r.Get("/events/{id}/save-count", eventHandler.SaveCount)
			r.Get("/venues", venueHandler.List)
			r.Get("/venues/{id}", venueHandler.Get)
		})

		// Authenticated routes (any signed-in user)
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth())
			r.Get("/me", userHandler.GetMe)
			r.Put("/me", userHandler.UpdateMe)
			r.Get("/me/events", userHandler.ListMyEvents)
			r.Get("/me/saved", userHandler.ListSaved)
			r.Post("/me/saved/{eventId}", userHandler.SaveEvent)
			r.Delete("/me/saved/{eventId}", userHandler.UnsaveEvent)
			r.Post("/author-applications", appHandler.Submit)
			r.Get("/me/application", appHandler.GetMyApplication)
			r.Get("/me/notifications", notificationHandler.GetPreferences)
			r.Put("/me/notifications", notificationHandler.UpdatePreferences)
			r.Post("/me/notifications/trigger-digest", notificationHandler.TriggerDigest)
			r.Post("/images/presign", imageHandler.Presign)
			r.Post("/images/confirm", imageHandler.Confirm)
			r.Get("/images", imageHandler.List)
			r.Delete("/images/{id}", imageHandler.Delete)
			r.Post("/suggestions", suggestionHandler.Create)
		})

		// Author/Admin routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth())
			r.Use(middleware.RequireRole(middleware.RoleAuthor, middleware.RoleAdmin))
			r.Post("/events", eventHandler.Create)
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
