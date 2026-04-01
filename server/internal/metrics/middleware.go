package metrics

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

// responseWriter wraps http.ResponseWriter to capture the status code and
// response body size.
type responseWriter struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int64
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.bytesWritten += int64(n)
	return n, err
}

// Middleware returns a Chi middleware that records Prometheus HTTP metrics.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		HTTPRequestsInFlight.Inc()
		defer HTTPRequestsInFlight.Dec()

		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		start := time.Now()

		next.ServeHTTP(rw, r)

		// Use Chi's route pattern for the label to avoid high cardinality.
		route := chi.RouteContext(r.Context()).RoutePattern()
		if route == "" {
			route = "unmatched"
		}

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(rw.statusCode)

		HTTPRequestsTotal.WithLabelValues(r.Method, route, status).Inc()
		HTTPRequestDuration.WithLabelValues(r.Method, route).Observe(duration)
		HTTPResponseSizeBytes.WithLabelValues(r.Method, route).Observe(float64(rw.bytesWritten))
	})
}
