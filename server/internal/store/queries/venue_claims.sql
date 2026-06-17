-- name: CreateVenueClaim :one
INSERT INTO venue_claims (
    clerk_id, venue_id, venue_name, address, city, state, zip, latitude, longitude,
    contact_name, contact_email, booking_email, message
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING *;

-- name: GetVenueClaim :one
SELECT * FROM venue_claims WHERE id = $1;

-- name: ListVenueClaimsByClerkID :many
SELECT * FROM venue_claims
WHERE clerk_id = $1
ORDER BY submitted_at DESC;

-- name: GetPendingVenueClaimForVenue :one
-- Used to block duplicate pending claims on the same existing venue.
SELECT * FROM venue_claims
WHERE venue_id = $1 AND status = 'pending'
LIMIT 1;

-- name: ListPendingVenueClaims :many
SELECT * FROM venue_claims
WHERE status = 'pending'
ORDER BY submitted_at ASC;

-- name: ApproveVenueClaim :one
UPDATE venue_claims SET
    status = 'approved',
    venue_id = COALESCE($2, venue_id),
    reviewed_at = NOW(),
    reviewed_by = $3,
    review_notes = $4
WHERE id = $1
RETURNING *;

-- name: RejectVenueClaim :one
UPDATE venue_claims SET
    status = 'rejected',
    reviewed_at = NOW(),
    reviewed_by = $2,
    review_notes = $3
WHERE id = $1
RETURNING *;
