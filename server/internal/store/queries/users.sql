-- name: GetUserByClerkID :one
SELECT * FROM users WHERE clerk_id = $1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: UpsertUser :one
INSERT INTO users (clerk_id, username, email)
VALUES ($1, $2, $3)
ON CONFLICT (clerk_id) DO UPDATE SET
    username = COALESCE(EXCLUDED.username, users.username),
    email = COALESCE(EXCLUDED.email, users.email),
    updated_at = NOW()
RETURNING *;

-- name: UpdateUserSettings :one
UPDATE users SET
    default_latitude = $2,
    default_longitude = $3,
    default_radius_miles = $4,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateUserPhoneNumber :exec
UPDATE users SET phone_number = $2, updated_at = NOW() WHERE id = $1;
