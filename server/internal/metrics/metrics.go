package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// HTTP metrics
var (
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests.",
		},
		[]string{"method", "route", "status"},
	)

	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Duration of HTTP requests in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "route"},
	)

	HTTPRequestsInFlight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Number of HTTP requests currently being served.",
		},
	)
)

// Cron job metrics
var (
	CronJobRunsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cron_job_runs_total",
			Help: "Total number of cron job executions.",
		},
		[]string{"job", "status"},
	)

	CronJobDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "cron_job_duration_seconds",
			Help:    "Duration of cron job executions in seconds.",
			Buckets: []float64{1, 5, 15, 30, 60, 120, 300, 600},
		},
		[]string{"job"},
	)

	CronJobItemsAffected = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "cron_job_items_affected",
			Help: "Number of items affected by the last cron job run.",
		},
		[]string{"job"},
	)
)

// Scraper metrics
var (
	ScraperEventsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "scraper_events_total",
			Help: "Total number of events processed by scrapers.",
		},
		[]string{"source", "status"},
	)
)
