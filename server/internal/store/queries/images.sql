-- name: CreateImage :one
INSERT INTO images (user_id, r2_key, url, filename, content_type, size_bytes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListImagesByUser :many
SELECT * FROM images
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetImage :one
SELECT * FROM images WHERE id = $1;

-- name: DeleteImage :exec
DELETE FROM images WHERE id = $1 AND user_id = $2;
