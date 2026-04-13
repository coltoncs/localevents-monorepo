-- name: ListEventIDsForSitemap :many
SELECT id, updated_at FROM events WHERE start_time >= NOW() ORDER BY start_time ASC;

-- name: ListVenueIDsForSitemap :many
SELECT id, updated_at FROM venues ORDER BY id ASC;
