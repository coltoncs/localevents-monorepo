-- name: CreateAuthorApplication :one
INSERT INTO author_applications (clerk_id, full_name, email, bio, experience)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetAuthorApplicationByClerkID :one
SELECT * FROM author_applications
WHERE clerk_id = $1
ORDER BY submitted_at DESC
LIMIT 1;

-- name: GetAuthorApplication :one
SELECT * FROM author_applications WHERE id = $1;

-- name: ListPendingApplications :many
SELECT * FROM author_applications
WHERE status = 'pending'
ORDER BY submitted_at ASC;

-- name: ApproveApplication :one
UPDATE author_applications SET
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = $2,
    review_notes = $3
WHERE id = $1
RETURNING *;

-- name: RejectApplication :one
UPDATE author_applications SET
    status = 'rejected',
    reviewed_at = NOW(),
    reviewed_by = $2,
    review_notes = $3
WHERE id = $1
RETURNING *;
