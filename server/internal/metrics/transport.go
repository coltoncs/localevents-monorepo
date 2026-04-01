package metrics

import (
	"net/http"
	"strconv"
	"time"
)

// InstrumentedTransport wraps an http.RoundTripper and records Prometheus
// metrics for each outbound request, labelled by service name.
type InstrumentedTransport struct {
	Service string
	Base    http.RoundTripper
}

func (t *InstrumentedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	start := time.Now()
	method := req.Method

	resp, err := t.base().RoundTrip(req)

	duration := time.Since(start).Seconds()

	if err != nil {
		ExternalRequestErrors.WithLabelValues(t.Service, method).Inc()
		ExternalRequestsTotal.WithLabelValues(t.Service, method, "error").Inc()
		ExternalRequestDuration.WithLabelValues(t.Service, method).Observe(duration)
		return nil, err
	}

	status := strconv.Itoa(resp.StatusCode)
	ExternalRequestsTotal.WithLabelValues(t.Service, method, status).Inc()
	ExternalRequestDuration.WithLabelValues(t.Service, method).Observe(duration)

	return resp, nil
}

func (t *InstrumentedTransport) base() http.RoundTripper {
	if t.Base != nil {
		return t.Base
	}
	return http.DefaultTransport
}

// NewInstrumentedClient creates an *http.Client whose outbound requests are
// recorded under the given service label.
func NewInstrumentedClient(service string, timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout:   timeout,
		Transport: &InstrumentedTransport{Service: service},
	}
}
