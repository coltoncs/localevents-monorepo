-- name: ListSavedEvents :many
SELECT e.*
FROM events e
JOIN saved_events se ON se.event_id = e.id
WHERE se.user_id = $1
ORDER BY e.start_time ASC;

-- name: ListSavedEventsForDigest :many
SELECT e.*
FROM events e
JOIN saved_events se ON se.event_id = e.id
WHERE se.user_id = $1
  AND e.start_time >= @start_date::timestamptz
  AND e.start_time < @end_date::timestamptz
ORDER BY e.start_time ASC;

-- name: SaveEvent :one
INSERT INTO saved_events (user_id, event_id)
VALUES ($1, $2)
ON CONFLICT (user_id, event_id) DO NOTHING
RETURNING *;

-- name: UnsaveEvent :exec
DELETE FROM saved_events WHERE user_id = $1 AND event_id = $2;

-- name: GetEventSaveCount :one
SELECT COUNT(*) FROM saved_events WHERE event_id = $1;

-- name: GetUserCategoryAffinities :many
SELECT unnest(e.categories)::text AS category, COUNT(*) AS save_count
FROM saved_events se
JOIN events e ON e.id = se.event_id
WHERE se.user_id = $1
GROUP BY category
ORDER BY save_count DESC
LIMIT 10;
