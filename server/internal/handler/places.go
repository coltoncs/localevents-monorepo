package handler

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type PlaceHandler struct {
	queries *store.Queries
}

func NewPlaceHandler(q *store.Queries) *PlaceHandler {
	return &PlaceHandler{queries: q}
}

const maxCuisineLen = 50

func validateCuisine(c string) bool {
	return c != "" && len(c) <= maxCuisineLen
}

func validateBarType(t string) bool {
	return t == "brewery" || t == "bar"
}

const checkInMaxDistanceMeters = 150.0

type checkInRequest struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusMeters = 6371000.0
	rad := math.Pi / 180.0
	dLat := (lat2 - lat1) * rad
	dLon := (lon2 - lon1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusMeters * c
}

type placeResponse struct {
	ID          string   `json:"ID"`
	Name        string   `json:"Name"`
	IsFood      bool     `json:"IsFood"`
	IsDrink     bool     `json:"IsDrink"`
	Cuisine     string   `json:"Cuisine,omitempty"`
	BarType     string   `json:"BarType,omitempty"`
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

func placeToResponse(p store.Place) placeResponse {
	id := uuid.UUID(p.ID.Bytes).String()

	var priceLevel *int32
	if p.PriceLevel.Valid {
		priceLevel = &p.PriceLevel.Int32
	}

	return placeResponse{
		ID:          id,
		Name:        p.Name,
		IsFood:      p.IsFood,
		IsDrink:     p.IsDrink,
		Cuisine:     p.Cuisine.String,
		BarType:     p.BarType.String,
		Address:     p.Address.String,
		City:        p.City.String,
		State:       p.State.String,
		Zip:         p.Zip.String,
		Latitude:    p.Latitude,
		Longitude:   p.Longitude,
		Phone:       p.Phone.String,
		Website:     p.Website.String,
		Hours:       p.Hours.String,
		Description: p.Description.String,
		Review:      p.Review.String,
		ImageUrl:    p.ImageUrl.String,
		Tags:        p.Tags,
		PriceLevel:  priceLevel,
	}
}

func (h *PlaceHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	latStr := q.Get("lat")
	lngStr := q.Get("lng")
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
	if v := q.Get("radius"); v != "" {
		radiusMiles, err = strconv.ParseFloat(v, 64)
		if err != nil {
			http.Error(w, `{"error":"invalid radius"}`, http.StatusBadRequest)
			return
		}
	}
	radiusMeters := radiusMiles * 1609.34

	requireFood := q.Get("is_food") == "true"
	requireDrink := q.Get("is_drink") == "true"

	cuisines := q["cuisine"]
	if cuisines == nil {
		cuisines = []string{}
	}

	barTypes := q["bar_type"]
	for _, t := range barTypes {
		if !validateBarType(t) {
			http.Error(w, `{"error":"invalid bar_type"}`, http.StatusBadRequest)
			return
		}
	}
	if barTypes == nil {
		barTypes = []string{}
	}

	var minPrice, maxPrice pgtype.Int4
	if v := q.Get("min_price"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 4 {
			http.Error(w, `{"error":"min_price must be 1..4"}`, http.StatusBadRequest)
			return
		}
		minPrice = pgtype.Int4{Int32: int32(n), Valid: true}
	}
	if v := q.Get("max_price"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 4 {
			http.Error(w, `{"error":"max_price must be 1..4"}`, http.StatusBadRequest)
			return
		}
		maxPrice = pgtype.Int4{Int32: int32(n), Valid: true}
	}

	var search pgtype.Text
	if s := q.Get("search"); s != "" {
		search = pgtype.Text{String: s, Valid: true}
	}

	rows, err := h.queries.ListPlacesByLocation(r.Context(), store.ListPlacesByLocationParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMeters,
		RequireFood:  requireFood,
		RequireDrink: requireDrink,
		Cuisines:     cuisines,
		BarTypes:     barTypes,
		MinPrice:     minPrice,
		MaxPrice:     maxPrice,
		Search:       search,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to query places"}`, http.StatusInternalServerError)
		return
	}

	places := make([]placeResponse, 0, len(rows))
	for _, row := range rows {
		places = append(places, placeToResponse(row))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Places []placeResponse `json:"places"`
	}{Places: places})
}

func (h *PlaceHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid place id"}`, http.StatusBadRequest)
		return
	}

	place, err := h.queries.GetPlace(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"place not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(placeToResponse(place))
}

type createPlaceRequest struct {
	Name        string   `json:"name"`
	IsFood      bool     `json:"is_food"`
	IsDrink     bool     `json:"is_drink"`
	Cuisine     *string  `json:"cuisine"`
	BarType     *string  `json:"bar_type"`
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

func validatePlaceRequest(req createPlaceRequest) (cuisine pgtype.Text, barType pgtype.Text, errMsg string) {
	if req.Name == "" {
		return cuisine, barType, "name is required"
	}
	if !req.IsFood && !req.IsDrink {
		return cuisine, barType, "place must be tagged as food, drink, or both"
	}
	if req.IsFood {
		c := ""
		if req.Cuisine != nil {
			c = *req.Cuisine
		}
		if !validateCuisine(c) {
			return cuisine, barType, "cuisine is required for food places"
		}
		cuisine = pgtype.Text{String: c, Valid: true}
	}
	if req.IsDrink {
		t := ""
		if req.BarType != nil {
			t = *req.BarType
		}
		if !validateBarType(t) {
			return cuisine, barType, "bar_type must be brewery or bar for drink places"
		}
		barType = pgtype.Text{String: t, Valid: true}
	}
	return cuisine, barType, ""
}

func (h *PlaceHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createPlaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	cuisine, barType, errMsg := validatePlaceRequest(req)
	if errMsg != "" {
		http.Error(w, `{"error":"`+errMsg+`"}`, http.StatusBadRequest)
		return
	}

	var priceLevel pgtype.Int4
	if req.PriceLevel != nil {
		priceLevel = pgtype.Int4{Int32: *req.PriceLevel, Valid: true}
	}

	place, err := h.queries.CreatePlace(r.Context(), store.CreatePlaceParams{
		Name:        req.Name,
		IsFood:      req.IsFood,
		IsDrink:     req.IsDrink,
		Cuisine:     cuisine,
		BarType:     barType,
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
		http.Error(w, `{"error":"failed to create place"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(placeToResponse(place))
}

func (h *PlaceHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid place id"}`, http.StatusBadRequest)
		return
	}

	var req createPlaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	cuisine, barType, errMsg := validatePlaceRequest(req)
	if errMsg != "" {
		http.Error(w, `{"error":"`+errMsg+`"}`, http.StatusBadRequest)
		return
	}

	var priceLevel pgtype.Int4
	if req.PriceLevel != nil {
		priceLevel = pgtype.Int4{Int32: *req.PriceLevel, Valid: true}
	}

	place, err := h.queries.UpdatePlace(r.Context(), store.UpdatePlaceParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		Name:        req.Name,
		IsFood:      req.IsFood,
		IsDrink:     req.IsDrink,
		Cuisine:     cuisine,
		BarType:     barType,
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
		http.Error(w, `{"error":"failed to update place"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(placeToResponse(place))
}

func (h *PlaceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid place id"}`, http.StatusBadRequest)
		return
	}

	if err := h.queries.DeletePlace(r.Context(), pgtype.UUID{Bytes: id, Valid: true}); err != nil {
		http.Error(w, `{"error":"failed to delete place"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaceHandler) CheckIn(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid place id"}`, http.StatusBadRequest)
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

	place, err := h.queries.GetPlace(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"place not found"}`, http.StatusNotFound)
		return
	}

	if haversineMeters(req.Latitude, req.Longitude, place.Latitude, place.Longitude) > checkInMaxDistanceMeters {
		http.Error(w, `{"error":"too far from venue to check in"}`, http.StatusForbidden)
		return
	}

	row, err := h.queries.CheckInPlace(r.Context(), store.CheckInPlaceParams{
		UserID:        user.ID,
		PlaceID:       pgtype.UUID{Bytes: id, Valid: true},
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

func (h *PlaceHandler) CheckInCounts(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid place id"}`, http.StatusBadRequest)
		return
	}

	counts, err := h.queries.GetPlaceCheckInCounts(r.Context(), pgtype.UUID{Bytes: id, Valid: true})
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

func (h *PlaceHandler) MyCheckInStatus(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid place id"}`, http.StatusBadRequest)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	checkedIn, err := h.queries.HasUserCheckedInPlaceToday(r.Context(), store.HasUserCheckedInPlaceTodayParams{
		UserID:  user.ID,
		PlaceID: pgtype.UUID{Bytes: id, Valid: true},
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
