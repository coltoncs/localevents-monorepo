-- name: ListPlannerEventsForUser :many
-- Events within the user's radius and the plan window, annotated with distance
-- (meters) and an optional preference score (cosine similarity to the user's
-- preference vector, NULL when the user has no vector or the event has no
-- embedding). LEFT JOIN keeps cold-start users covered. Ordered by ET day then
-- start time; the planner re-ranks within each day before persisting.
WITH u AS (
    SELECT preference_vector FROM user_preferences WHERE user_id = @user_id
)
SELECT e.*,
       ST_Distance(
           ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
           ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography
       )::float AS distance_meters,
       CASE WHEN (SELECT preference_vector FROM u) IS NOT NULL
            THEN (1 - (ee.embedding <=> (SELECT preference_vector FROM u)))::float
            ELSE NULL END AS pref_score
FROM events e
LEFT JOIN event_embeddings ee ON ee.event_id = e.id
WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
    @radius_meters::float
)
AND e.start_time >= @start_date::timestamptz
AND e.start_time < @end_date::timestamptz
ORDER BY (e.start_time AT TIME ZONE 'America/New_York')::date ASC, e.start_time ASC;

-- name: UpsertDailyPlan :exec
INSERT INTO daily_plans (user_id, week_of, plan, generated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (user_id, week_of) DO UPDATE SET
    plan = EXCLUDED.plan,
    generated_at = NOW();

-- name: GetLatestDailyPlan :one
SELECT week_of, plan, generated_at FROM daily_plans
WHERE user_id = $1
ORDER BY week_of DESC
LIMIT 1;

-- name: CreateSharedPlan :one
INSERT INTO shared_plans (plan, created_by)
VALUES ($1, $2)
RETURNING token;

-- name: GetSharedPlan :one
SELECT plan, created_at FROM shared_plans WHERE token = $1;
