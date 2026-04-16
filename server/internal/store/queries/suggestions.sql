-- name: CreateEditSuggestion :one
INSERT INTO edit_suggestions (target_type, target_id, submitted_by, proposed_changes, action, reason)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetEditSuggestion :one
SELECT * FROM edit_suggestions WHERE id = $1;

-- name: ListPendingEditSuggestions :many
SELECT * FROM edit_suggestions
WHERE status = 'pending'
ORDER BY created_at ASC;

-- name: ListPendingEditSuggestionsForTarget :many
SELECT * FROM edit_suggestions
WHERE target_type = $1 AND target_id = $2 AND status = 'pending'
ORDER BY created_at ASC;

-- name: ListPendingEditSuggestionsForAuthor :many
SELECT es.* FROM edit_suggestions es
JOIN events e ON es.target_type = 'event' AND es.target_id = e.id
JOIN users u ON e.submitted_by = u.id
WHERE u.clerk_id = $1 AND es.status = 'pending'
ORDER BY es.created_at ASC;

-- name: ApproveEditSuggestion :one
UPDATE edit_suggestions SET
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = $2,
    review_notes = $3
WHERE id = $1
RETURNING *;

-- name: RejectEditSuggestion :one
UPDATE edit_suggestions SET
    status = 'rejected',
    reviewed_at = NOW(),
    reviewed_by = $2,
    review_notes = $3
WHERE id = $1
RETURNING *;
