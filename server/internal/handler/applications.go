package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type ApplicationHandler struct {
	queries *store.Queries
}

func NewApplicationHandler(q *store.Queries) *ApplicationHandler {
	return &ApplicationHandler{queries: q}
}

type submitApplicationRequest struct {
	FullName   string `json:"full_name"`
	Email      string `json:"email"`
	Bio        string `json:"bio"`
	Experience string `json:"experience"`
}

func (h *ApplicationHandler) Submit(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req submitApplicationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.FullName == "" || req.Email == "" || req.Bio == "" || req.Experience == "" {
		http.Error(w, `{"error":"all fields are required"}`, http.StatusBadRequest)
		return
	}

	// Check for existing pending application
	existing, err := h.queries.GetAuthorApplicationByClerkID(r.Context(), clerkID)
	if err == nil && existing.Status == "pending" {
		http.Error(w, `{"error":"you already have a pending application"}`, http.StatusConflict)
		return
	}

	app, err := h.queries.CreateAuthorApplication(r.Context(), store.CreateAuthorApplicationParams{
		ClerkID:    clerkID,
		FullName:   req.FullName,
		Email:      req.Email,
		Bio:        req.Bio,
		Experience: req.Experience,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to create application"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(app)
}

func (h *ApplicationHandler) GetMyApplication(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	app, err := h.queries.GetAuthorApplicationByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"no application found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(app)
}

func (h *ApplicationHandler) ListPending(w http.ResponseWriter, r *http.Request) {
	apps, err := h.queries.ListPendingApplications(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to list applications"}`, http.StatusInternalServerError)
		return
	}

	if apps == nil {
		apps = []store.AuthorApplication{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apps)
}

type reviewRequest struct {
	ReviewNotes string `json:"review_notes"`
}

func (h *ApplicationHandler) Approve(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid application id"}`, http.StatusBadRequest)
		return
	}

	var req reviewRequest
	json.NewDecoder(r.Body).Decode(&req)

	app, err := h.queries.ApproveApplication(r.Context(), store.ApproveApplicationParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		ReviewedBy:  pgtype.Text{String: clerkID, Valid: true},
		ReviewNotes: pgtype.Text{String: req.ReviewNotes, Valid: req.ReviewNotes != ""},
	})
	if err != nil {
		http.Error(w, `{"error":"failed to approve application"}`, http.StatusInternalServerError)
		return
	}

	// Promote user to author in Clerk
	if err := middleware.SetUserRole(r.Context(), app.ClerkID, middleware.RoleAuthor); err != nil {
		http.Error(w, `{"error":"approved but failed to set role in Clerk"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(app)
}

func (h *ApplicationHandler) Reject(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid application id"}`, http.StatusBadRequest)
		return
	}

	var req reviewRequest
	json.NewDecoder(r.Body).Decode(&req)

	app, err := h.queries.RejectApplication(r.Context(), store.RejectApplicationParams{
		ID:          pgtype.UUID{Bytes: id, Valid: true},
		ReviewedBy:  pgtype.Text{String: clerkID, Valid: true},
		ReviewNotes: pgtype.Text{String: req.ReviewNotes, Valid: req.ReviewNotes != ""},
	})
	if err != nil {
		http.Error(w, `{"error":"failed to reject application"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(app)
}
