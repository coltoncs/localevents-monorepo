-- name: CheckInFood :one
INSERT INTO food_checkins (user_id, food_id, user_latitude, user_longitude)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, food_id, checkin_date) DO NOTHING
RETURNING *;

-- name: GetFoodCheckInCounts :one
SELECT
    COUNT(*)::bigint AS total_count,
    COUNT(DISTINCT user_id)::bigint AS unique_count
FROM food_checkins
WHERE food_id = $1;

-- name: HasUserCheckedInFoodToday :one
SELECT EXISTS(
    SELECT 1 FROM food_checkins
    WHERE user_id = $1 AND food_id = $2 AND checkin_date = CURRENT_DATE
) AS checked_in;

-- name: ListUserFoodCheckIns :many
SELECT
    c.id,
    c.food_id,
    c.checkin_date,
    c.created_at,
    f.name AS food_name,
    f.cuisine AS food_cuisine,
    f.city AS food_city,
    f.image_url AS food_image_url
FROM food_checkins c
JOIN foods f ON f.id = c.food_id
WHERE c.user_id = $1
ORDER BY c.checkin_date DESC, c.created_at DESC;

-- name: GetUserFoodCheckInStats :one
SELECT
    COUNT(*)::bigint AS total_checkins,
    COUNT(DISTINCT food_id)::bigint AS unique_restaurants,
    MIN(c.checkin_date)::date AS first_checkin_date,
    MAX(c.checkin_date)::date AS last_checkin_date
FROM food_checkins c
WHERE c.user_id = $1;
