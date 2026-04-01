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

	HTTPResponseSizeBytes = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_response_size_bytes",
			Help:    "Size of HTTP response bodies in bytes.",
			Buckets: []float64{100, 1000, 10000, 100000, 500000, 1000000, 5000000},
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

// External service call metrics
var (
	ExternalRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "external_requests_total",
			Help: "Total number of outbound HTTP requests to external services.",
		},
		[]string{"service", "method", "status"},
	)

	ExternalRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "external_request_duration_seconds",
			Help:    "Duration of outbound HTTP requests to external services in seconds.",
			Buckets: []float64{0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30},
		},
		[]string{"service", "method"},
	)

	ExternalRequestErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "external_request_errors_total",
			Help: "Total number of failed outbound HTTP requests (network errors).",
		},
		[]string{"service", "method"},
	)
)

// Database connection pool metrics
var (
	DBPoolTotalConns = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_pool_total_conns",
			Help: "Total number of connections in the database pool.",
		},
	)

	DBPoolIdleConns = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_pool_idle_conns",
			Help: "Number of idle connections in the database pool.",
		},
	)

	DBPoolAcquiredConns = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_pool_acquired_conns",
			Help: "Number of currently acquired connections in the database pool.",
		},
	)

	DBPoolMaxConns = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_pool_max_conns",
			Help: "Maximum number of connections allowed in the database pool.",
		},
	)

	DBPoolAcquireCount = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "db_pool_acquire_total",
			Help: "Cumulative count of successful connection acquires.",
		},
	)

	DBPoolAcquireDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "db_pool_acquire_duration_seconds",
			Help:    "Time spent acquiring a connection from the pool.",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1},
		},
	)

	DBPoolEmptyAcquireCount = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "db_pool_empty_acquire_total",
			Help: "Cumulative count of acquires that had to wait for a connection (pool was empty).",
		},
	)

	DBPoolCanceledAcquireCount = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "db_pool_canceled_acquire_total",
			Help: "Cumulative count of acquires that were canceled.",
		},
	)
)

// Auth metrics
var (
	AuthFailuresTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_failures_total",
			Help: "Total number of authentication/authorization failures.",
		},
		[]string{"reason"},
	)
)
