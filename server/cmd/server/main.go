package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/config"
	"github.com/coltonsweeney/localevents/server/internal/database"
	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/router"
	"github.com/coltonsweeney/localevents/server/internal/scraper"
	"github.com/coltonsweeney/localevents/server/internal/store"
	"github.com/robfig/cron/v3"
)

func main() {
	cfg := config.Load()

	middleware.SetClerkAPIKey(cfg.ClerkSecretKey)

	ctx := context.Background()
	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := database.RunMigrations(ctx, pool, "migrations"); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	queries := store.New(pool)

	c := cron.New()

	// Cleanup: delete past events and stale deletion records daily at 3 AM
	c.AddFunc("0 3 * * *", func() {
		deleted, err := queries.DeletePastEvents(context.Background())
		if err != nil {
			log.Printf("Event cleanup failed: %v", err)
		} else {
			log.Printf("Event cleanup: deleted %d past events", deleted)
		}
		cleaned, err := queries.CleanOldDeletedExternalEvents(context.Background())
		if err != nil {
			log.Printf("Deletion records cleanup failed: %v", err)
		} else if cleaned > 0 {
			log.Printf("Deletion records cleanup: removed %d stale records", cleaned)
		}
	})

	// Set up event scraper cron job
	if cfg.ScraperEnabled {
		var sources []scraper.EventSource
		// Local sources run first so their events take priority during dedup
		sources = append(sources, scraper.NewCityOfRaleigh())
		sources = append(sources, scraper.NewDiscoverDurham())
		if cfg.TicketmasterAPIKey != "" {
			sources = append(sources, scraper.NewTicketmaster(cfg.TicketmasterAPIKey))
		} else {
			log.Println("TICKETMASTER_API_KEY not set, Ticketmaster scraper disabled")
		}
		if cfg.SeatGeekClientID != "" {
			sources = append(sources, scraper.NewSeatGeek(cfg.SeatGeekClientID))
		} else {
			log.Println("SEATGEEK_CLIENT_ID not set, SeatGeek scraper disabled")
		}
		if cfg.BandsintownAppID != "" {
			sources = append(sources, scraper.NewBandsintown(cfg.BandsintownAppID))
		} else {
			log.Println("BANDSINTOWN_APP_ID not set, Bandsintown scraper disabled")
		}

		var locations []scraper.Location
		locations = append(locations, scraper.NCCities...)
		locations = append(locations, scraper.VACities...)
		locations = append(locations, scraper.SCCities...)

		runner := &scraper.Runner{
			Sources:   sources,
			Locations: locations,
			Queries:   queries,
		}

		c.AddFunc(cfg.ScraperCronSchedule, func() {
			runner.Run(context.Background())
		})

		// Run once on startup
		go func() {
			log.Println("Running initial event scrape...")
			runner.Run(context.Background())
		}()

		log.Printf("Scraper enabled (schedule: %s)", cfg.ScraperCronSchedule)
	}

	c.Start()
	defer c.Stop()

	r := router.New(queries, cfg)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Server starting on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server stopped")
}
