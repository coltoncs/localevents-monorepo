package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/coltonsweeney/localevents/server/internal/store"
)

// CoverageHandler exposes where we currently have event data, so the digest
// signup can steer anonymous users toward locations the weekly email will
// actually be useful for.
type CoverageHandler struct {
	queries *store.Queries
}

func NewCoverageHandler(q *store.Queries) *CoverageHandler {
	return &CoverageHandler{queries: q}
}

// minCoverageCityEvents is how many upcoming events a city needs before it's
// advertised as covered — enough to keep one-off listings from implying we
// serve an area we don't.
const minCoverageCityEvents = 3

// defaultCoverageRadiusMiles is the radius, in miles, used both to decide
// whether a signup falls inside our coverage area and (client-side) which
// nearby locations to surface around a covered city. Matches the default
// digest radius so "there are events within your radius" stays consistent.
const defaultCoverageRadiusMiles = 25

type coverageCity struct {
	City       string  `json:"city"`
	State      string  `json:"state"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	EventCount int64   `json:"event_count"`
}

// Cities returns the cities with upcoming events plus the coverage radius the
// client should apply around them. Public, unauthenticated.
func (h *CoverageHandler) Cities(w http.ResponseWriter, r *http.Request) {
	rows, err := h.queries.ListCoverageCities(r.Context(), minCoverageCityEvents)
	if err != nil {
		log.Printf("Coverage: failed to list coverage cities: %v", err)
		http.Error(w, `{"error":"failed to load coverage"}`, http.StatusInternalServerError)
		return
	}

	cities := make([]coverageCity, 0, len(rows))
	for _, row := range rows {
		cities = append(cities, coverageCity{
			City:       row.City.String,
			State:      row.State.String,
			Latitude:   row.Latitude,
			Longitude:  row.Longitude,
			EventCount: row.EventCount,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"cities":       cities,
		"radius_miles": defaultCoverageRadiusMiles,
	})
}
