package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
	"github.com/coltonsweeney/localevents/server/internal/storage"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type ImageHandler struct {
	queries   *store.Queries
	r2        *storage.R2Client
	s3Presign *s3.PresignClient
}

func NewImageHandler(q *store.Queries, r2 *storage.R2Client) *ImageHandler {
	h := &ImageHandler{queries: q, r2: r2}
	if r2 != nil {
		h.s3Presign = s3.NewPresignClient(r2.Client())
	}
	return h
}

type presignRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
}

type presignResponse struct {
	UploadURL string `json:"upload_url"`
	PublicURL string `json:"public_url"`
	Key       string `json:"key"`
}

func (h *ImageHandler) Presign(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req presignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Filename == "" || req.ContentType == "" {
		http.Error(w, `{"error":"filename and content_type are required"}`, http.StatusBadRequest)
		return
	}

	if !strings.HasPrefix(req.ContentType, "image/") {
		http.Error(w, `{"error":"only image files are allowed"}`, http.StatusBadRequest)
		return
	}

	ext := filepath.Ext(req.Filename)
	if ext == "" {
		// Derive extension from content type
		switch req.ContentType {
		case "image/jpeg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/webp":
			ext = ".webp"
		case "image/gif":
			ext = ".gif"
		default:
			ext = ".bin"
		}
	}

	key := fmt.Sprintf("users/%s/%s%s", clerkID, uuid.New().String(), ext)

	presigned, err := h.s3Presign.PresignPutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      stringPtr(h.r2.Bucket()),
		Key:         &key,
		ContentType: &req.ContentType,
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		http.Error(w, `{"error":"failed to generate upload URL"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(presignResponse{
		UploadURL: presigned.URL,
		PublicURL: fmt.Sprintf("%s/%s", h.r2.PublicURL(), key),
		Key:       key,
	})
}

type confirmRequest struct {
	Key         string `json:"key"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
}

func (h *ImageHandler) Confirm(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req confirmRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Key == "" || req.Filename == "" || req.ContentType == "" {
		http.Error(w, `{"error":"key, filename, and content_type are required"}`, http.StatusBadRequest)
		return
	}

	// Verify the key belongs to this user
	expectedPrefix := fmt.Sprintf("users/%s/", clerkID)
	if !strings.HasPrefix(req.Key, expectedPrefix) {
		http.Error(w, `{"error":"unauthorized key"}`, http.StatusForbidden)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	publicURL := fmt.Sprintf("%s/%s", h.r2.PublicURL(), req.Key)

	image, err := h.queries.CreateImage(r.Context(), store.CreateImageParams{
		UserID:      user.ID,
		R2Key:       req.Key,
		Url:         publicURL,
		Filename:    req.Filename,
		ContentType: req.ContentType,
		SizeBytes:   pgtype.Int8{Int64: req.SizeBytes, Valid: req.SizeBytes > 0},
	})
	if err != nil {
		http.Error(w, `{"error":"failed to save image record"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(image)
}

func (h *ImageHandler) List(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	images, err := h.queries.ListImagesByUser(r.Context(), user.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to list images"}`, http.StatusInternalServerError)
		return
	}

	if images == nil {
		images = []store.Image{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(images)
}

func (h *ImageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	clerkID := middleware.GetClerkUserID(r.Context())
	if clerkID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	imageID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid image ID"}`, http.StatusBadRequest)
		return
	}

	user, err := h.queries.GetUserByClerkID(r.Context(), clerkID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	// Get the image first to delete from R2
	image, err := h.queries.GetImage(r.Context(), pgtype.UUID{Bytes: imageID, Valid: true})
	if err != nil {
		http.Error(w, `{"error":"image not found"}`, http.StatusNotFound)
		return
	}

	// Delete from R2
	_, _ = h.r2.Client().DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: stringPtr(h.r2.Bucket()),
		Key:    &image.R2Key,
	})

	// Delete from DB
	err = h.queries.DeleteImage(r.Context(), store.DeleteImageParams{
		ID:     pgtype.UUID{Bytes: imageID, Valid: true},
		UserID: user.ID,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to delete image"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func stringPtr(s string) *string { return &s }
