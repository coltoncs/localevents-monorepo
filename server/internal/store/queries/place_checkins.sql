-- name: CheckInPlace :one
INSERT INTO place_checkins (user_id, place_id, user_latitude, user_longitude)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, place_id, checkin_date) DO NOTHING
RETURNING *;

-- name: GetPlaceCheckInCounts :one
SELECT
    COUNT(*)::bigint AS total_count,
    COUNT(DISTINCT user_id)::bigint AS unique_count
FROM place_checkins
WHERE place_id = $1;

-- name: HasUserCheckedInPlaceToday :one
SELECT EXISTS(
    SELECT 1 FROM place_checkins
    WHERE user_id = $1 AND place_id = $2 AND checkin_date = CURRENT_DATE
) AS checked_in;

-- name: ListUserPlaceCheckIns :many
SELECT
    c.id,
    c.place_id,
    c.checkin_date,
    c.created_at,
    p.name AS place_name,
    p.is_food AS place_is_food,
    p.is_drink AS place_is_drink,
    p.cuisine AS place_cuisine,
    p.bar_type AS place_bar_type,
    p.city AS place_city,
    p.image_url AS place_image_url
FROM place_checkins c
JOIN places p ON p.id = c.place_id
WHERE c.user_id = $1
ORDER BY c.checkin_date DESC, c.created_at DESC;

-- name: GetUserPlaceCheckInStats :one
SELECT
    COUNT(*)::bigint AS total_checkins,
    COUNT(DISTINCT c.place_id)::bigint AS unique_places,
    COUNT(DISTINCT CASE WHEN p.is_food THEN c.place_id END)::bigint AS unique_foods,
    COUNT(DISTINCT CASE WHEN p.is_drink AND p.bar_type = 'brewery' THEN c.place_id END)::bigint AS unique_breweries,
    COUNT(DISTINCT CASE WHEN p.is_drink AND p.bar_type = 'bar' THEN c.place_id END)::bigint AS unique_bars,
    MIN(c.checkin_date)::date AS first_checkin_date,
    MAX(c.checkin_date)::date AS last_checkin_date
FROM place_checkins c
JOIN places p ON p.id = c.place_id
WHERE c.user_id = $1;
