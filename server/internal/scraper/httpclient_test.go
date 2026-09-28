package scraper

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestBrowserClientSetsBrowserHeaders(t *testing.T) {
	var got http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Clone()
	}))
	defer srv.Close()

	resp, err := newBrowserClient("test", 5*time.Second).Get(srv.URL)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	resp.Body.Close()

	if ua := got.Get("User-Agent"); ua != browserUserAgent {
		t.Errorf("User-Agent = %q, want %q", ua, browserUserAgent)
	}
	if got.Get("Accept-Language") == "" {
		t.Error("Accept-Language not set")
	}
	// Accept-Encoding must stay unset so net/http keeps decompressing gzip.
	if ae := got.Get("Accept-Encoding"); ae != "gzip" {
		t.Errorf("Accept-Encoding = %q, want net/http's own %q", ae, "gzip")
	}
}

func TestBrowserClientPreservesExplicitHeaders(t *testing.T) {
	var got http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Clone()
	}))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL, nil)
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	req.Header.Set("User-Agent", "custom-agent")

	resp, err := newBrowserClient("test", 5*time.Second).Do(req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	resp.Body.Close()

	if ua := got.Get("User-Agent"); ua != "custom-agent" {
		t.Errorf("User-Agent = %q, want %q", ua, "custom-agent")
	}
	// The original request must not be mutated by the transport.
	if ua := req.Header.Get("Accept-Language"); ua != "" {
		t.Errorf("transport mutated caller's request: Accept-Language = %q", ua)
	}
}
