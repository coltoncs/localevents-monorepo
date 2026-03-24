package storage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"log"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// R2Client wraps an S3-compatible client for Cloudflare R2.
type R2Client struct {
	client    *s3.Client
	bucket    string
	publicURL string // e.g. "https://img.919events.com"
}

// NewR2Client creates a new R2 client from Cloudflare credentials.
func NewR2Client(accountID, accessKeyID, secretAccessKey, publicURL, bucket string) *R2Client {
	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID)

	s3Client := s3.New(s3.Options{
		Region:       "auto",
		Credentials:  credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, ""),
		BaseEndpoint: &endpoint,
	})

	return &R2Client{
		client:    s3Client,
		bucket:    bucket,
		publicURL: strings.TrimRight(publicURL, "/"),
	}
}

// Client returns the underlying S3 client for direct operations (presigning, etc.).
func (r *R2Client) Client() *s3.Client {
	return r.client
}

// Bucket returns the bucket name.
func (r *R2Client) Bucket() string {
	return r.bucket
}

// PublicURL returns the public base URL.
func (r *R2Client) PublicURL() string {
	return r.publicURL
}

// MirrorImage downloads an external image and uploads it to R2 under
// the "events/" prefix. The key is derived from a SHA-256 hash of the
// source URL to provide natural dedup. Returns the public R2 URL.
// If the image already exists in R2, it returns the URL without re-uploading.
func (r *R2Client) MirrorImage(ctx context.Context, sourceURL string) (string, error) {
	if sourceURL == "" {
		return "", nil
	}

	// Already on our domain — nothing to do.
	if strings.HasPrefix(sourceURL, r.publicURL) {
		return sourceURL, nil
	}

	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(sourceURL)))
	ext := extFromURL(sourceURL)
	key := fmt.Sprintf("events/%s%s", hash, ext)

	// Check if object already exists (HeadObject is cheap).
	_, err := r.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: &r.bucket,
		Key:    &key,
	})
	if err == nil {
		return fmt.Sprintf("%s/%s", r.publicURL, key), nil
	}

	// Download the external image.
	httpClient := &http.Client{Timeout: 15 * time.Second}
	resp, err := httpClient.Get(sourceURL)
	if err != nil {
		return "", fmt.Errorf("download image: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download image: status %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		contentType = "image/jpeg" // fallback
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20)) // 10 MB max
	if err != nil {
		return "", fmt.Errorf("read image body: %w", err)
	}

	// Upload to R2.
	_, err = r.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      &r.bucket,
		Key:         &key,
		Body:        bytes.NewReader(body),
		ContentType: &contentType,
	})
	if err != nil {
		return "", fmt.Errorf("upload to R2: %w", err)
	}

	publicURL := fmt.Sprintf("%s/%s", r.publicURL, key)
	log.Printf("Mirrored image: %s -> %s", sourceURL, publicURL)
	return publicURL, nil
}

// DeleteByPublicURL deletes an object from R2 given its full public URL.
func (r *R2Client) DeleteByPublicURL(ctx context.Context, publicURL string) error {
	key := strings.TrimPrefix(publicURL, r.publicURL+"/")
	if key == publicURL {
		return fmt.Errorf("URL %s does not match public URL prefix %s", publicURL, r.publicURL)
	}

	_, err := r.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: &r.bucket,
		Key:    &key,
	})
	return err
}

// extFromURL extracts a file extension from a URL path, defaulting to ".jpg".
func extFromURL(rawURL string) string {
	// Strip query string first.
	u := rawURL
	if idx := strings.Index(u, "?"); idx != -1 {
		u = u[:idx]
	}
	ext := strings.ToLower(path.Ext(u))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif":
		return ext
	default:
		return ".jpg"
	}
}
