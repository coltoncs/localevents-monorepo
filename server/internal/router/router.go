package router

import (
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"

	"github.com/coltonsweeney/localevents/server/internal/handler"
	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

func New(queries *store.Queries, corsOrigins string) *chi.Mux {
	r := chi.NewRouter()

	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RealIP)
	r.Use(middleware.CORS(corsOrigins))

	eventHandler := handler.NewEventHandler(queries)
	venueHandler := handler.NewVenueHandler(queries)
	userHandler := handler.NewUserHandler(queries)
	appHandler := handler.NewApplicationHandler(queries)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", handler.HealthCheck)

		// Public routes with optional auth
		r.Group(func(r chi.Router) {
			r.Use(middleware.OptionalAuth())
			r.Get("/events", eventHandler.List)
			r.Get("/events/{id}", eventHandler.Get)
			r.Get("/venues", venueHandler.List)
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
		})

		// Author/Admin routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth())
			r.Use(middleware.RequireRole(middleware.RoleAuthor, middleware.RoleAdmin))
			r.Post("/events", eventHandler.Create)
			r.Put("/events/{id}", eventHandler.Update)
			r.Delete("/events/{id}", eventHandler.Delete)
		})

		// Admin routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth())
			r.Use(middleware.RequireRole(middleware.RoleAdmin))
			r.Get("/admin/applications", appHandler.ListPending)
			r.Post("/admin/applications/{id}/approve", appHandler.Approve)
			r.Post("/admin/applications/{id}/reject", appHandler.Reject)
		})
	})

	return r
}
