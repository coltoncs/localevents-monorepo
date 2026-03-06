package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/coltonsweeney/localevents/server/internal/store"
)

type VenueHandler struct {
	queries *store.Queries
}

func NewVenueHandler(q *store.Queries) *VenueHandler {
	return &VenueHandler{queries: q}
}

type venueResponse struct {
	VenueName string  `json:"VenueName"`
	Address   string  `json:"Address"`
	City      string  `json:"City"`
	State     string  `json:"State"`
	Zip       string  `json:"Zip"`
	Latitude  float64 `json:"Latitude"`
	Longitude float64 `json:"Longitude"`
}

func (h *VenueHandler) List(w http.ResponseWriter, r *http.Request) {
	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	if latStr == "" || lngStr == "" {
		http.Error(w, `{"error":"lat and lng are required"}`, http.StatusBadRequest)
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid lat"}`, http.StatusBadRequest)
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid lng"}`, http.StatusBadRequest)
		return
	}

	radiusMiles := 100.0
	if v := r.URL.Query().Get("radius"); v != "" {
		radiusMiles, err = strconv.ParseFloat(v, 64)
		if err != nil {
			http.Error(w, `{"error":"invalid radius"}`, http.StatusBadRequest)
			return
		}
	}
	radiusMeters := radiusMiles * 1609.34

	rows, err := h.queries.ListDistinctVenues(r.Context(), store.ListDistinctVenuesParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMeters,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to query venues"}`, http.StatusInternalServerError)
		return
	}

	venues := make([]venueResponse, 0, len(rows))
	for _, row := range rows {
		venues = append(venues, venueResponse{
			VenueName: row.VenueName.String,
			Address:   row.Address.String,
			City:      row.City.String,
			State:     row.State.String,
			Zip:       row.Zip.String,
			Latitude:  row.Latitude,
			Longitude: row.Longitude,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Venues []venueResponse `json:"venues"`
	}{Venues: venues})
}
