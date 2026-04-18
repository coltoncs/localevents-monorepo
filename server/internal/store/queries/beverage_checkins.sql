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
