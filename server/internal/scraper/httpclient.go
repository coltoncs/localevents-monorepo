package scraper

import (
	"net/http"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/metrics"
)

// browserUserAgent is sent on requests to sources fronted by Akamai. Those
// edges reject anything advertising Go's default "Go-http-client/..." agent
// with a 403 "Access Denied" HTML page, which breaks the Simpleview token
// endpoint before any event data is fetched.
const browserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

// browserHeaderTransport stamps browser-like request headers onto every
// outbound request before delegating to Base.
type browserHeaderTransport struct {
	Base http.RoundTripper
}

func (t *browserHeaderTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// A RoundTripper must not mutate the request it is handed.
	clone := req.Clone(req.Context())
	// Accept-Encoding is deliberately left alone: setting it here would stop
	// net/http from transparently decompressing gzip responses.
	setHeaderIfEmpty(clone.Header, "User-Agent", browserUserAgent)
	setHeaderIfEmpty(clone.Header, "Accept", "*/*")
	setHeaderIfEmpty(clone.Header, "Accept-Language", "en-US,en;q=0.9")

	base := t.Base
	if base == nil {
		base = http.DefaultTransport
	}
	return base.RoundTrip(clone)
}

func setHeaderIfEmpty(h http.Header, key, value string) {
	if h.Get(key) == "" {
		h.Set(key, value)
	}
}

// newBrowserClient creates an instrumented *http.Client that presents itself
// as a browser. Use it for sources behind bot-protection CDNs.
func newBrowserClient(service string, timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout: timeout,
		Transport: &browserHeaderTransport{
			Base: &metrics.InstrumentedTransport{Service: service},
		},
	}
}
