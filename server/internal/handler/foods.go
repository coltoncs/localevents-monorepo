package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type FoodHandler struct {
	queries *store.Queries
}

func NewFoodHandler(q *store.Queries) *FoodHandler {
	return &FoodHandler{queries: q}
}

var allowedCuisines = map[string]bool{
	"american": true, "italian": true, "mexican": true, "chinese": true,
	"japanese": true, "korean": true, "thai": true, "vietnamese": true,
	"indian": true, "mediterranean": true, "middle_eastern": true, "french": true,
	"bbq": true, "pizza": true, "seafood": true, "vegan": true,
	"cafe": true, "bakery": true, "dessert": true, "other": true,
}

type foodResponse struct {
	ID          string   `json:"ID"`
	Name        string   `json:"Name"`
	Cuisine     string   `json:"Cuisine"`
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

func foodToResponse(f store.Food) foodResponse {
	id := uuid.UUID(f.ID.Bytes).String()

	var priceLevel *int32
	if f.PriceLevel.Valid {
		priceLevel = &f.PriceLevel.Int32
	}

	return foodResponse{
		ID:          id,
		Name:        f.Name,
		Cuisine:     f.Cuisine,
		Address:     f.Address.String,
		City:        f.City.String,
		State:       f.State.String,
		Zip:         f.Zip.String,
		Latitude:    f.Latitude,
		Longitude:   f.Longitude,
		Phone:       f.Phone.String,
		Website:     f.Website.String,
		Hours:       f.Hours.String,
		Description: f.Description.String,
		Review:      f.Review.String,
		ImageUrl:    f.ImageUrl.String,
		Tags:        f.Tags,
		PriceLevel:  priceLevel,
	}
}

func (h *FoodHandler) List(w http.ResponseWriter, r *http.Request) {
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

	cuisines := r.URL.Query()["cuisine"]
	for _, c := range cuisines {
		if !allowedCuisines[c] {
			http.Error(w, `{"error":"invalid cuisine: `+c+`"}`, http.StatusBadRequest)
			return
		}
	}
	if cuisines == nil {
		cuisines = []string{}
	}

	var minPrice, maxPrice pgtype.Int4
	if v := r.URL.Query().Get("min_price"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 4 {
			http.Error(w, `{"error":"min_price must be 1..4"}`, http.StatusBadRequest)
			return
		}
		minPrice = pgtype.Int4{Int32: int32(n), Valid: true}
	}
	if v := r.URL.Query().Get("max_price"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 4 {
			http.Error(w, `{"error":"max_price must be 1..4"}`, http.StatusBadRequest)
			return
		}
		maxPrice = pgtype.Int4{Int32: int32(n), Valid: true}
	}

	var search pgtype.Text
	if s := r.URL.Query().Get("search"); s != "" {
		search = pgtype.Text{String: s, Valid: true}
	}

	rows, err := h.queries.ListFoodsByLocation(r.Context(), store.ListFoodsByLocationParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMeters,
		Cuisines:     cuisines,
		MinPrice:     minPrice,
		MaxPrice:     maxPrice,
		Search:       search,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to query foods"}`, http.StatusInternalServerError)
		return
	}

	foods := make([]foodResponse, 0, len(rows))
	for _, row := range rows {
		foods = append(foods, foodToResponse(row))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Foods []foodResponse `json:"foods"`
	}{Foods: foods})
}

func (h *FoodHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid food id"}`, http.StatusBadRequest)
		return
	}

	food, err := h.queries.GetFood(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"food not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(foodToResponse(food))
}

type createFoodRequest struct {
	Name        string   `json:"name"`
	Cuisine     string   `json:"cuisine"`
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

func (h *FoodHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createFoodRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}
	if !allowedCuisines[req.Cuisine] {
		http.Error(w, `{"error":"invalid cuisine"}`, http.StatusBadRequest)
		return
	}

	var priceLevel pgtype.Int4
	if req.PriceLevel != nil {
		priceLevel = pgtype.Int4{Int32: *req.PriceLevel, Valid: true}
	}

	food, err := h.queries.CreateFood(r.Context(), store.CreateFoodParams{
		Name:        req.Name,
		Cuisine:     req.Cuisine,
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
		http.Error(w, `{"error":"failed to create food"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(foodToResponse(food))
}

func (h *FoodHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid food id"}`, http.StatusBadRequest)
		return
	}

	var req createFoodRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}
	if !allowedCuisines[req.Cuisine] {
		http.Error(w, `{"error":"invalid cuisine"}`, http.StatusBadRequest)
		return
	}

	var priceLevel pgtype.Int4
	if req.PriceLevel != nil {
		priceLevel = pgtype.Int4{Int32: *req.PriceLevel, Valid: true}
	}

	food, err := h.queries.UpdateFood(r.Context(), store.UpdateFoodParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		Name:        req.Name,
		Cuisine:     req.Cuisine,
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
		http.Error(w, `{"error":"failed to update food"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(foodToResponse(food))
}

func (h *FoodHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid food id"}`, http.StatusBadRequest)
		return
	}

	err = h.queries.DeleteFood(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"failed to delete food"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *FoodHandler) CheckIn(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid food id"}`, http.StatusBadRequest)
		return
	}

	var req checkInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	food, err := h.queries.GetFood(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"food not found"}`, http.StatusNotFound)
		return
	}

	if haversineMeters(req.Latitude, req.Longitude, food.Latitude, food.Longitude) > checkInMaxDistanceMeters {
		http.Error(w, `{"error":"too far from venue to check in"}`, http.StatusForbidden)
		return
	}

	row, err := h.queries.CheckInFood(r.Context(), store.CheckInFoodParams{
		UserID:        user.ID,
		FoodID:        pgtype.UUID{Bytes: id, Valid: true},
		UserLatitude:  req.Latitude,
		UserLongitude: req.Longitude,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, `{"error":"already checked in today"}`, http.StatusConflict)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"failed to check in"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(row)
}

func (h *FoodHandler) CheckInCounts(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid food id"}`, http.StatusBadRequest)
		return
	}

	counts, err := h.queries.GetFoodCheckInCounts(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"failed to get check-in counts"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Total  int64 `json:"total"`
		Unique int64 `json:"unique"`
	}{Total: counts.TotalCount, Unique: counts.UniqueCount})
}

func (h *FoodHandler) MyCheckInStatus(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid food id"}`, http.StatusBadRequest)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	checkedIn, err := h.queries.HasUserCheckedInFoodToday(r.Context(), store.HasUserCheckedInFoodTodayParams{
		UserID: user.ID,
		FoodID: pgtype.UUID{Bytes: id, Valid: true},
	})
	if err != nil {
		http.Error(w, `{"error":"failed to check status"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		CheckedInToday bool `json:"checkedInToday"`
	}{CheckedInToday: checkedIn})
}
