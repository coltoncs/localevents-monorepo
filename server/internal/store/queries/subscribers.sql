-- name: UpsertEmailSubscriber :one
-- Create a pending (unconfirmed) anonymous subscriber, or refresh the location
-- of an existing one. Idempotent: re-subscribing an already-confirmed email just
-- updates its location and leaves it confirmed (the handler skips resending the
-- confirmation email in that case). The confirm/unsubscribe tokens are minted
-- once at insert and preserved across updates.
INSERT INTO email_digest_subscribers (email, latitude, longitude, radius_miles)
VALUES ($1, $2, $3, $4)
ON CONFLICT (email) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    radius_miles = EXCLUDED.radius_miles
RETURNING *;

-- name: ConfirmEmailSubscriber :one
UPDATE email_digest_subscribers
SET confirmed = TRUE, confirmed_at = NOW()
WHERE confirm_token = $1
RETURNING *;

-- name: ListConfirmedAnonymousSubscribers :many
SELECT * FROM email_digest_subscribers
WHERE confirmed = TRUE;

-- name: MarkAnonymousSubscriberSent :exec
UPDATE email_digest_subscribers SET last_sent_at = NOW() WHERE id = $1;

-- name: UnsubscribeAnonymousByToken :exec
DELETE FROM email_digest_subscribers WHERE unsubscribe_token = $1;
