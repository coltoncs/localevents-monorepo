-- name: InsertCronLog :exec
INSERT INTO cron_log (job_name, items_affected, details)
VALUES ($1, $2, $3);

-- name: GetLatestCronLog :one
SELECT * FROM cron_log
WHERE job_name = $1
ORDER BY ran_at DESC
LIMIT 1;
