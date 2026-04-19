-- name: CheckInBeverage :one
INSERT INTO beverage_checkins (user_id, beverage_id, user_latitude, user_longitude)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, beverage_id, checkin_date) DO NOTHING
RETURNING *;

-- name: GetBeverageCheckInCounts :one
SELECT
    COUNT(*)::bigint AS total_count,
    COUNT(DISTINCT user_id)::bigint AS unique_count
FROM beverage_checkins
WHERE beverage_id = $1;

-- name: HasUserCheckedInToday :one
SELECT EXISTS(
    SELECT 1 FROM beverage_checkins
    WHERE user_id = $1 AND beverage_id = $2 AND checkin_date = CURRENT_DATE
) AS checked_in;

-- name: ListUserCheckIns :many
SELECT
    c.id,
    c.beverage_id,
    c.checkin_date,
    c.created_at,
    b.name AS beverage_name,
    b.type AS beverage_type,
    b.city AS beverage_city,
    b.image_url AS beverage_image_url
FROM beverage_checkins c
JOIN beverages b ON b.id = c.beverage_id
WHERE c.user_id = $1
ORDER BY c.checkin_date DESC, c.created_at DESC;

-- name: GetUserCheckInStats :one
SELECT
    COUNT(*)::bigint AS total_checkins,
    COUNT(DISTINCT beverage_id)::bigint AS unique_venues,
    COUNT(DISTINCT CASE WHEN b.type = 'brewery' THEN c.beverage_id END)::bigint AS unique_breweries,
    COUNT(DISTINCT CASE WHEN b.type = 'bar' THEN c.beverage_id END)::bigint AS unique_bars,
    MIN(c.checkin_date)::date AS first_checkin_date,
    MAX(c.checkin_date)::date AS last_checkin_date
FROM beverage_checkins c
JOIN beverages b ON b.id = c.beverage_id
WHERE c.user_id = $1;
