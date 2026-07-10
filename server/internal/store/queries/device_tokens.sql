-- name: UpsertDeviceToken :one
INSERT INTO device_tokens (user_id, token, platform)
VALUES ($1, $2, $3)
ON CONFLICT (token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    updated_at = NOW()
RETURNING *;

-- name: DeleteDeviceToken :exec
DELETE FROM device_tokens WHERE token = $1 AND user_id = $2;

-- name: DeleteDeviceTokenByToken :exec
DELETE FROM device_tokens WHERE token = $1;

-- name: ListDeviceTokensByUser :many
SELECT * FROM device_tokens WHERE user_id = $1 ORDER BY created_at ASC;

-- name: ListAllDeviceTokens :many
SELECT dt.id, dt.token, dt.platform, u.id AS user_id, u.clerk_id
FROM device_tokens dt
JOIN users u ON u.id = dt.user_id
ORDER BY u.id, dt.created_at ASC;
