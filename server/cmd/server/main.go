package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/config"
	"github.com/coltonsweeney/localevents/server/internal/database"
	"github.com/coltonsweeney/localevents/server/internal/metrics"
	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/notifier"
	"github.com/coltonsweeney/localevents/server/internal/router"
	"github.com/coltonsweeney/localevents/server/internal/scraper"
	"github.com/coltonsweeney/localevents/server/internal/storage"
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

	dbPoolDone := make(chan struct{})
	metrics.StartDBPoolCollector(pool, 15*time.Second, dbPoolDone)
	defer close(dbPoolDone)

	queries := store.New(pool)

	// Create shared R2 client if credentials are configured.
	var r2 *storage.R2Client
	if cfg.R2AccountID != "" && cfg.R2AccessKeyID != "" && cfg.R2SecretAccessKey != "" && cfg.R2PublicURL != "" {
		r2 = storage.NewR2Client(cfg.R2AccountID, cfg.R2AccessKeyID, cfg.R2SecretAccessKey, cfg.R2PublicURL, cfg.R2Bucket)
	}

	c := cron.New()

	// Cleanup: delete past events, orphaned images, and stale deletion records.
	// Scheduled just before the weekly digest so digest emails never reference
	// images that get deleted later in the week.
	c.AddFunc(cfg.CleanupCronSchedule, func() {
		start := time.Now()
		ctx := context.Background()
		var eventsDeleted int64
		var imagesDeleted int
		var staleRemoved int64
		jobStatus := "success"

		// Collect orphaned image URLs before deleting events.
		var orphanedURLs []string
		if r2 != nil {
			pgURLs, err := queries.ListPastEventImageURLs(ctx)
			if err != nil {
				log.Printf("Orphaned image query failed: %v", err)
			} else {
				for _, u := range pgURLs {
					if u.Valid {
						orphanedURLs = append(orphanedURLs, u.String)
					}
				}
			}
		}

		deleted, err := queries.DeletePastEvents(ctx)
		if err != nil {
			log.Printf("Event cleanup failed: %v", err)
			jobStatus = "error"
		} else {
			eventsDeleted = deleted
			log.Printf("Event cleanup: deleted %d past events", deleted)
		}

		// Delete orphaned images from R2.
		if len(orphanedURLs) > 0 {
			for _, u := range orphanedURLs {
				if err := r2.DeleteByPublicURL(ctx, u); err != nil {
					log.Printf("Image cleanup: failed to delete %s: %v", u, err)
				} else {
					imagesDeleted++
				}
			}
			log.Printf("Image cleanup: deleted %d orphaned images from R2", imagesDeleted)
		}

		cleaned, err := queries.CleanOldDeletedExternalEvents(ctx)
		if err != nil {
			log.Printf("Deletion records cleanup failed: %v", err)
			jobStatus = "error"
		} else {
			staleRemoved = cleaned
			if cleaned > 0 {
				log.Printf("Deletion records cleanup: removed %d stale records", cleaned)
			}
		}

		metrics.CronJobRunsTotal.WithLabelValues("cleanup", jobStatus).Inc()
		metrics.CronJobDuration.WithLabelValues("cleanup").Observe(time.Since(start).Seconds())
		metrics.CronJobItemsAffected.WithLabelValues("cleanup").Set(float64(eventsDeleted))

		details, _ := json.Marshal(map[string]int{
			"events_deleted": int(eventsDeleted),
			"images_deleted": imagesDeleted,
			"stale_removed":  int(staleRemoved),
		})
		queries.InsertCronLog(ctx, store.InsertCronLogParams{
			JobName:       "cleanup",
			ItemsAffected: int32(eventsDeleted),
			Details:       details,
		})
	})

	// Set up event scraper cron job
	if cfg.ScraperEnabled {
		var sources []scraper.EventSource
		// Local sources run first so their events take priority during dedup
		sources = append(sources, scraper.NewCityOfRaleigh())
		// TODO: re-enable once Discover Durham scraper is fixed
		// sources = append(sources, scraper.NewDiscoverDurham())
		sources = append(sources, scraper.NewVisitRichmond())
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

		if r2 != nil {
			runner.R2 = r2
			log.Println("Image mirroring to R2 enabled")
		} else {
			log.Println("R2 credentials not fully set, image mirroring disabled")
		}

		c.AddFunc(cfg.ScraperCronSchedule, func() {
			start := time.Now()
			runner.Run(context.Background())
			metrics.CronJobRunsTotal.WithLabelValues("scraper", "success").Inc()
			metrics.CronJobDuration.WithLabelValues("scraper").Observe(time.Since(start).Seconds())
		})

		// Run once on startup
		go func() {
			log.Println("Running initial event scrape...")
			start := time.Now()
			runner.Run(context.Background())
			metrics.CronJobRunsTotal.WithLabelValues("scraper", "success").Inc()
			metrics.CronJobDuration.WithLabelValues("scraper").Observe(time.Since(start).Seconds())
		}()

		log.Printf("Scraper enabled (schedule: %s)", cfg.ScraperCronSchedule)
	}

	// Set up digest runner (always created so admin trigger works)
	digestRunner := &notifier.Runner{
		Queries:        queries,
		FrontendURL:    cfg.FrontendURL,
		ClerkSecretKey: cfg.ClerkSecretKey,
	}
	if cfg.ResendAPIKey != "" {
		digestRunner.Email = notifier.NewEmailSender(cfg.ResendAPIKey, "digest@919events.com")
	} else {
		log.Println("RESEND_API_KEY not set, email digest disabled")
	}
	if cfg.TwilioAccountSID != "" && cfg.TwilioAuthToken != "" && cfg.TwilioFromNumber != "" {
		digestRunner.SMS = notifier.NewSMSSender(cfg.TwilioAccountSID, cfg.TwilioAuthToken, cfg.TwilioFromNumber)
	} else {
		log.Println("Twilio credentials not fully set, SMS digest disabled")
	}

	// Set up weekly digest cron job
	if cfg.DigestEnabled {
		c.AddFunc(cfg.DigestCronSchedule, func() {
			start := time.Now()
			digestRunner.Run(context.Background())
			metrics.CronJobRunsTotal.WithLabelValues("digest", "success").Inc()
			metrics.CronJobDuration.WithLabelValues("digest").Observe(time.Since(start).Seconds())
		})
		log.Printf("Digest enabled (schedule: %s)", cfg.DigestCronSchedule)
	}

	c.Start()
	defer c.Stop()

	r := router.New(queries, pool, cfg, digestRunner, r2)

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
