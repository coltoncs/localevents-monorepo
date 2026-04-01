# Prometheus Metrics Reference

All metrics exposed at `GET /metrics`. Built-in Go runtime metrics (`go_*`, `process_*`) are included automatically by `promhttp.Handler()`.

---

## HTTP Metrics

### http_requests_total
- **Type:** Counter
- **Labels:** `method`, `route`, `status`
- **Description:** Total number of HTTP requests.

```promql
# Request rate (per second) over 5 minutes
rate(http_requests_total[5m])

# Error rate (5xx responses)
sum(rate(http_requests_total{status=~"5.."}[5m]))

# Error ratio by route
sum(rate(http_requests_total{status=~"5.."}[5m])) by (route)
  / sum(rate(http_requests_total[5m])) by (route)

# Top 10 busiest routes
topk(10, sum(rate(http_requests_total[5m])) by (route))
```

### http_request_duration_seconds
- **Type:** Histogram
- **Labels:** `method`, `route`
- **Unit:** seconds
- **Buckets:** 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10

```promql
# p50 latency by route
histogram_quantile(0.5, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))

# p95 latency by route
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))

# p99 latency (global)
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# Average latency by route
sum(rate(http_request_duration_seconds_sum[5m])) by (route)
  / sum(rate(http_request_duration_seconds_count[5m])) by (route)
```

### http_response_size_bytes
- **Type:** Histogram
- **Labels:** `method`, `route`
- **Unit:** bytes
- **Buckets:** 100, 1000, 10000, 100000, 500000, 1000000, 5000000

```promql
# p95 response size by route
histogram_quantile(0.95, sum(rate(http_response_size_bytes_bucket[5m])) by (le, route))

# Average response size by route
sum(rate(http_response_size_bytes_sum[5m])) by (route)
  / sum(rate(http_response_size_bytes_count[5m])) by (route)

# Routes returning largest responses
topk(10, sum(rate(http_response_size_bytes_sum[5m])) by (route)
  / sum(rate(http_response_size_bytes_count[5m])) by (route))
```

### http_requests_in_flight
- **Type:** Gauge
- **Labels:** none
- **Description:** Number of HTTP requests currently being served.

```promql
# Current in-flight requests
http_requests_in_flight

# Alert if sustained high concurrency (> 100 for 5 min)
http_requests_in_flight > 100
```

---

## Auth Metrics

### auth_failures_total
- **Type:** Counter
- **Labels:** `reason`
- **Description:** Total number of authentication/authorization failures.

| reason             | When                                                 |
|--------------------|------------------------------------------------------|
| missing_token      | RequireAuth: no Bearer token in Authorization header |
| invalid_token      | RequireAuth: Clerk JWT verification failed           |
| missing_clerk_id   | RequireRole: no Clerk user ID in context             |
| role_check_error   | RequireRole: Clerk API call to fetch role failed     |
| insufficient_role  | RequireRole: user role not in allowed set            |

```promql
# Auth failure rate by reason
sum(rate(auth_failures_total[5m])) by (reason)

# Total auth failures per minute
sum(rate(auth_failures_total[1m])) * 60

# Alert: spike in invalid tokens (possible abuse)
rate(auth_failures_total{reason="invalid_token"}[5m]) > 0.5
```

---

## External Service Metrics

### external_requests_total
- **Type:** Counter
- **Labels:** `service`, `method`, `status`
- **Description:** Total outbound HTTP requests to external services.

| service        | Target                                  |
|----------------|-----------------------------------------|
| ticketmaster   | Ticketmaster Discovery API              |
| seatgeek       | SeatGeek API v2                         |
| bandsintown    | Bandsintown Events Search API           |
| visitraleigh   | Visit Raleigh events API                |
| visitrichmond  | Visit Richmond VA events API            |
| discoverdurham | Discover Durham events site             |
| resend         | Resend email API                        |
| twilio         | Twilio SMS API                          |
| r2_mirror      | External image downloads (for R2 mirror)|
| clerk_billing  | Clerk billing/subscription API          |

```promql
# Request rate per service
sum(rate(external_requests_total[5m])) by (service)

# Error rate per service (5xx or network errors)
sum(rate(external_requests_total{status=~"5..|error"}[5m])) by (service)

# Success ratio per service
sum(rate(external_requests_total{status=~"2.."}[5m])) by (service)
  / sum(rate(external_requests_total[5m])) by (service)
```

### external_request_duration_seconds
- **Type:** Histogram
- **Labels:** `service`, `method`
- **Unit:** seconds
- **Buckets:** 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30

```promql
# p95 latency per service
histogram_quantile(0.95, sum(rate(external_request_duration_seconds_bucket[5m])) by (le, service))

# Average latency per service
sum(rate(external_request_duration_seconds_sum[5m])) by (service)
  / sum(rate(external_request_duration_seconds_count[5m])) by (service)

# Slowest services
topk(5, sum(rate(external_request_duration_seconds_sum[5m])) by (service)
  / sum(rate(external_request_duration_seconds_count[5m])) by (service))
```

### external_request_errors_total
- **Type:** Counter
- **Labels:** `service`, `method`
- **Description:** Network-level errors (DNS failure, timeout, connection refused). Does not include HTTP error status codes.

```promql
# Network error rate per service
sum(rate(external_request_errors_total[5m])) by (service)
```

---

## Database Connection Pool Metrics

Polled every 15 seconds from `pgxpool.Pool.Stat()`.

### db_pool_total_conns
- **Type:** Gauge
- **Description:** Total connections in the pool (idle + acquired + constructing).

### db_pool_idle_conns
- **Type:** Gauge
- **Description:** Connections sitting idle, ready for use.

### db_pool_acquired_conns
- **Type:** Gauge
- **Description:** Connections currently checked out by application code.

### db_pool_max_conns
- **Type:** Gauge
- **Description:** Maximum connections the pool is configured to hold.

### db_pool_acquire_total
- **Type:** Counter
- **Description:** Cumulative count of successful connection acquires.

### db_pool_acquire_duration_seconds
- **Type:** Histogram
- **Unit:** seconds
- **Buckets:** 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1

### db_pool_empty_acquire_total
- **Type:** Counter
- **Description:** Acquires that had to wait because the pool was empty (no idle connections available).

### db_pool_canceled_acquire_total
- **Type:** Counter
- **Description:** Acquires that were canceled (e.g. context deadline exceeded while waiting).

```promql
# Pool utilization (%)
db_pool_acquired_conns / db_pool_max_conns * 100

# Pool saturation — when this is high, queries are waiting
db_pool_acquired_conns / db_pool_total_conns

# Connection acquire rate
rate(db_pool_acquire_total[5m])

# p95 acquire latency
histogram_quantile(0.95, rate(db_pool_acquire_duration_seconds_bucket[5m]))

# Empty-acquire rate (pool exhaustion events)
rate(db_pool_empty_acquire_total[5m])

# Canceled acquire rate (timeouts waiting for a connection)
rate(db_pool_canceled_acquire_total[5m])

# Alert: pool utilization > 80% for 5 minutes
db_pool_acquired_conns / db_pool_max_conns > 0.8
```

---

## Cron Job Metrics

### cron_job_runs_total
- **Type:** Counter
- **Labels:** `job`, `status`
- **Description:** Total cron job executions.

| job     | status  |
|---------|---------|
| scraper | success |
| cleanup | success / error |
| digest  | success |

```promql
# Cron runs per job
sum(rate(cron_job_runs_total[1h])) by (job)

# Cron error rate
sum(rate(cron_job_runs_total{status="error"}[1h])) by (job)
```

### cron_job_duration_seconds
- **Type:** Histogram
- **Labels:** `job`
- **Unit:** seconds
- **Buckets:** 1, 5, 15, 30, 60, 120, 300, 600

```promql
# Average cron job duration
sum(rate(cron_job_duration_seconds_sum[1h])) by (job)
  / sum(rate(cron_job_duration_seconds_count[1h])) by (job)

# p95 scraper duration
histogram_quantile(0.95, rate(cron_job_duration_seconds_bucket{job="scraper"}[6h]))
```

### cron_job_items_affected
- **Type:** Gauge (per-label)
- **Labels:** `job`
- **Description:** Number of items affected by the last cron job run.

```promql
# Items affected in last cleanup
cron_job_items_affected{job="cleanup"}
```

---

## Scraper Metrics

### scraper_events_total
- **Type:** Counter
- **Labels:** `source`, `status`
- **Description:** Total events processed by scrapers.

```promql
# Events scraped per source
sum(rate(scraper_events_total[6h])) by (source)

# Events by status (created, updated, skipped, error)
sum(rate(scraper_events_total[6h])) by (source, status)
```

---

## Built-in Go Runtime Metrics

These are automatically exposed. Key ones to dashboard:

### go_goroutines
- **Type:** Gauge

```promql
# Current goroutine count
go_goroutines

# Alert: goroutine leak (sustained increase)
delta(go_goroutines[1h]) > 500
```

### go_memstats_heap_inuse_bytes
- **Type:** Gauge
- **Unit:** bytes

```promql
# Heap in use (MB)
go_memstats_heap_inuse_bytes / 1024 / 1024
```

### go_gc_duration_seconds
- **Type:** Summary

```promql
# p99 GC pause duration
go_gc_duration_seconds{quantile="0.99"}

# GC pause rate
rate(go_gc_duration_seconds_count[5m])
```

### process_resident_memory_bytes
- **Type:** Gauge
- **Unit:** bytes

```promql
# RSS in MB
process_resident_memory_bytes / 1024 / 1024

# Alert: approaching Railway memory limit
process_resident_memory_bytes > 450 * 1024 * 1024
```

### process_cpu_seconds_total
- **Type:** Counter
- **Unit:** seconds

```promql
# CPU utilization (0-1 per core)
rate(process_cpu_seconds_total[5m])
```

### process_open_fds
- **Type:** Gauge

```promql
# File descriptor usage
process_open_fds

# FD usage ratio
process_open_fds / process_max_fds
```
