package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/store"
)

type BeverageHandler struct {
	queries *store.Queries
}

func NewBeverageHandler(q *store.Queries) *BeverageHandler {
	return &BeverageHandler{queries: q}
}

type beverageResponse struct {
	ID          string   `json:"ID"`
	Name        string   `json:"Name"`
	Type        string   `json:"Type"`
	Address     string   `json:"Address"`
	City        string   `json:"City"`
	State       string   `json:"State"`
	Zip         string   `json:"Zip"`
	Latitude    float64  `json:"Latitude"`
	Longitude   float64  `json:"Longitude"`
	Phone       string   `json:"Phone,omitempty"`
	Website     string   `json:"Website,omitempty"`
	Hours       string   `json:"Hours,omitempty"`
	Description string   `json:"Description,omitempty"`
	Review      string   `json:"Review,omitempty"`
	ImageUrl    string   `json:"ImageUrl,omitempty"`
	Tags        []string `json:"Tags,omitempty"`
	PriceLevel  *int32   `json:"PriceLevel,omitempty"`
}

func beverageToResponse(b store.Beverage) beverageResponse {
	idBytes := b.ID.Bytes
	id := uuid.UUID(idBytes).String()

	var priceLevel *int32
	if b.PriceLevel.Valid {
		priceLevel = &b.PriceLevel.Int32
	}

	return beverageResponse{
		ID:          id,
		Name:        b.Name,
		Type:        b.Type,
		Address:     b.Address.String,
		City:        b.City.String,
		State:       b.State.String,
		Zip:         b.Zip.String,
		Latitude:    b.Latitude,
		Longitude:   b.Longitude,
		Phone:       b.Phone.String,
		Website:     b.Website.String,
		Hours:       b.Hours.String,
		Description: b.Description.String,
		Review:      b.Review.String,
		ImageUrl:    b.ImageUrl.String,
		Tags:        b.Tags,
		PriceLevel:  priceLevel,
	}
}

func (h *BeverageHandler) List(w http.ResponseWriter, r *http.Request) {
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

	radiusMiles := 10.0
	if v := r.URL.Query().Get("radius"); v != "" {
		radiusMiles, err = strconv.ParseFloat(v, 64)
		if err != nil {
			http.Error(w, `{"error":"invalid radius"}`, http.StatusBadRequest)
			return
		}
	}
	radiusMeters := radiusMiles * 1609.34

	bevType := r.URL.Query().Get("type")

	rows, err := h.queries.ListBeveragesByLocation(r.Context(), store.ListBeveragesByLocationParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMeters,
		BevType:      bevType,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to query beverages"}`, http.StatusInternalServerError)
		return
	}

	beverages := make([]beverageResponse, 0, len(rows))
	for _, row := range rows {
		beverages = append(beverages, beverageToResponse(row))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Beverages []beverageResponse `json:"beverages"`
	}{Beverages: beverages})
}

func (h *BeverageHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid beverage id"}`, http.StatusBadRequest)
		return
	}

	beverage, err := h.queries.GetBeverage(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"beverage not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(beverageToResponse(beverage))
}

type createBeverageRequest struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	Address     *string  `json:"address"`
	City        *string  `json:"city"`
	State       *string  `json:"state"`
	Zip         *string  `json:"zip"`
	Latitude    float64  `json:"latitude"`
	Longitude   float64  `json:"longitude"`
	Phone       *string  `json:"phone"`
	Website     *string  `json:"website"`
	Hours       *string  `json:"hours"`
	Description *string  `json:"description"`
	Review      *string  `json:"review"`
	ImageUrl    *string  `json:"image_url"`
	Tags        []string `json:"tags"`
	PriceLevel  *int32   `json:"price_level"`
}

func (h *BeverageHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createBeverageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}
	if req.Type != "brewery" && req.Type != "bar" {
		http.Error(w, `{"error":"type must be brewery or bar"}`, http.StatusBadRequest)
		return
	}

	var priceLevel pgtype.Int4
	if req.PriceLevel != nil {
		priceLevel = pgtype.Int4{Int32: *req.PriceLevel, Valid: true}
	}

	beverage, err := h.queries.CreateBeverage(r.Context(), store.CreateBeverageParams{
		Name:        req.Name,
		Type:        req.Type,
		Address:     textFromPtr(req.Address),
		City:        textFromPtr(req.City),
		State:       textFromPtr(req.State),
		Zip:         textFromPtr(req.Zip),
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		Phone:       textFromPtr(req.Phone),
		Website:     textFromPtr(req.Website),
		Hours:       textFromPtr(req.Hours),
		Description: textFromPtr(req.Description),
		Review:      textFromPtr(req.Review),
		ImageUrl:    textFromPtr(req.ImageUrl),
		Tags:        req.Tags,
		PriceLevel:  priceLevel,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to create beverage"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(beverageToResponse(beverage))
}

func (h *BeverageHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid beverage id"}`, http.StatusBadRequest)
		return
	}

	var req createBeverageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}
	if req.Type != "brewery" && req.Type != "bar" {
		http.Error(w, `{"error":"type must be brewery or bar"}`, http.StatusBadRequest)
		return
	}

	var priceLevel pgtype.Int4
	if req.PriceLevel != nil {
		priceLevel = pgtype.Int4{Int32: *req.PriceLevel, Valid: true}
	}

	beverage, err := h.queries.UpdateBeverage(r.Context(), store.UpdateBeverageParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		Name:        req.Name,
		Type:        req.Type,
		Address:     textFromPtr(req.Address),
		City:        textFromPtr(req.City),
		State:       textFromPtr(req.State),
		Zip:         textFromPtr(req.Zip),
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		Phone:       textFromPtr(req.Phone),
		Website:     textFromPtr(req.Website),
		Hours:       textFromPtr(req.Hours),
		Description: textFromPtr(req.Description),
		Review:      textFromPtr(req.Review),
		ImageUrl:    textFromPtr(req.ImageUrl),
		Tags:        req.Tags,
		PriceLevel:  priceLevel,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to update beverage"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(beverageToResponse(beverage))
}

func (h *BeverageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid beverage id"}`, http.StatusBadRequest)
		return
	}

	err = h.queries.DeleteBeverage(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"failed to delete beverage"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
