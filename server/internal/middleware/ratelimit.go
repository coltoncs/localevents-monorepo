package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// RateLimit limits requests per client IP using a fixed window. It is intended
// for public write endpoints (e.g. anonymous suggestion submissions) to blunt
// spam. State is kept in memory, so limits are per-instance, not global.
func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	l := &ipRateLimiter{
		limit:   limit,
		window:  window,
		buckets: make(map[string]*fixedWindow),
	}
	go l.reap()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !l.allow(clientIP(r)) {
				http.Error(w, `{"error":"too many requests, please try again later"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

type fixedWindow struct {
	count       int
	windowStart time.Time
}

type ipRateLimiter struct {
	limit   int
	window  time.Duration
	mu      sync.Mutex
	buckets map[string]*fixedWindow
}

func (l *ipRateLimiter) allow(ip string) bool {
	now := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	b, ok := l.buckets[ip]
	if !ok || now.Sub(b.windowStart) >= l.window {
		l.buckets[ip] = &fixedWindow{count: 1, windowStart: now}
		return true
	}
	if b.count >= l.limit {
		return false
	}
	b.count++
	return true
}

// reap periodically drops stale buckets so the map does not grow unbounded.
func (l *ipRateLimiter) reap() {
	ticker := time.NewTicker(l.window)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		l.mu.Lock()
		for ip, b := range l.buckets {
			if now.Sub(b.windowStart) >= l.window {
				delete(l.buckets, ip)
			}
		}
		l.mu.Unlock()
	}
}

func clientIP(r *http.Request) string {
	// chimiddleware.RealIP has already normalized RemoteAddr from proxy headers.
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}
