-- name: RecordEventView :exec
INSERT INTO event_views (user_id, event_id, viewed_at)
VALUES ($1, $2, NOW())
ON CONFLICT (user_id, event_id) DO UPDATE SET viewed_at = NOW();

-- name: EnsureUserPreferences :exec
INSERT INTO user_preferences (user_id)
VALUES ($1)
ON CONFLICT (user_id) DO NOTHING;

-- name: MarkUserPreferencesStale :exec
UPDATE user_preferences
SET needs_recompute = TRUE
WHERE user_id = $1;

-- name: GetUserPreferencesState :one
-- signal_count is derived live so it cannot drift from saved_events/event_views.
-- The stored column on user_preferences is no longer read.
SELECT
    ((SELECT COUNT(*) FROM saved_events se WHERE se.user_id = $1)
        + (SELECT COUNT(*) FROM event_views ev WHERE ev.user_id = $1))::int AS signal_count,
    up.needs_recompute,
    (up.preference_vector IS NOT NULL)::bool AS has_vector
FROM user_preferences up
WHERE up.user_id = $1;

-- name: ListTrendingFutureEvents :many
SELECT e.*, COUNT(se.user_id) AS save_count
FROM events e
LEFT JOIN saved_events se ON se.event_id = e.id
WHERE e.start_time > NOW()
  AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
      @radius_meters::float
  )
GROUP BY e.id
ORDER BY save_count DESC, e.start_time ASC
LIMIT @event_limit;
