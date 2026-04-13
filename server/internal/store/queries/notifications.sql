-- name: UpsertNotificationPreferences :one
INSERT INTO notification_preferences (user_id, email_enabled, sms_enabled, preferred_categories, digest_format, email_style)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id) DO UPDATE SET
    email_enabled = EXCLUDED.email_enabled,
    sms_enabled = EXCLUDED.sms_enabled,
    preferred_categories = EXCLUDED.preferred_categories,
    digest_format = EXCLUDED.digest_format,
    email_style = EXCLUDED.email_style,
    updated_at = NOW()
RETURNING *;

-- name: GetNotificationPreferences :one
SELECT * FROM notification_preferences WHERE user_id = $1;

-- name: ListEmailSubscribers :many
SELECT u.id, u.email, u.default_latitude, u.default_longitude, u.default_radius_miles,
       np.email_unsubscribe_token, np.preferred_categories, np.digest_format, np.email_style
FROM users u
JOIN notification_preferences np ON np.user_id = u.id
WHERE np.email_enabled = TRUE
  AND u.email IS NOT NULL
  AND u.default_latitude IS NOT NULL
  AND u.default_longitude IS NOT NULL;

-- name: GetEmailSubscriberByID :one
SELECT u.id, u.email, u.default_latitude, u.default_longitude, u.default_radius_miles,
       np.email_unsubscribe_token, np.preferred_categories, np.digest_format, np.email_style
FROM users u
JOIN notification_preferences np ON np.user_id = u.id
WHERE u.id = $1
  AND np.email_enabled = TRUE
  AND u.email IS NOT NULL
  AND u.default_latitude IS NOT NULL
  AND u.default_longitude IS NOT NULL;

-- name: ListSMSSubscribers :many
SELECT u.id, u.clerk_id, u.phone_number, u.default_latitude, u.default_longitude, u.default_radius_miles,
       np.sms_unsubscribe_token, np.preferred_categories
FROM users u
JOIN notification_preferences np ON np.user_id = u.id
WHERE np.sms_enabled = TRUE
  AND u.phone_number IS NOT NULL
  AND u.default_latitude IS NOT NULL
  AND u.default_longitude IS NOT NULL;

-- name: UnsubscribeByEmailToken :exec
UPDATE notification_preferences SET email_enabled = FALSE, updated_at = NOW()
WHERE email_unsubscribe_token = $1;

-- name: UnsubscribeSMSByPhoneNumber :exec
UPDATE notification_preferences SET sms_enabled = FALSE, updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE phone_number = $1 LIMIT 1);

-- name: ResubscribeSMSByPhoneNumber :exec
UPDATE notification_preferences SET sms_enabled = TRUE, updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE phone_number = $1 LIMIT 1);

-- name: UnsubscribeBySMSToken :exec
UPDATE notification_preferences SET sms_enabled = FALSE, updated_at = NOW()
WHERE sms_unsubscribe_token = $1;

-- name: ListUpcomingEventsForDigest :many
SELECT *
FROM events
WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
    @radius_meters::float
)
AND start_time >= @start_date::timestamptz
AND start_time < @end_date::timestamptz
ORDER BY start_time ASC
LIMIT @max_events::int;

-- name: CreateNotificationLog :exec
INSERT INTO notification_log (user_id, channel, event_count, status, error_message)
VALUES ($1, $2, $3, $4, $5);

-- name: GetLastNotificationSent :one
SELECT * FROM notification_log
WHERE user_id = $1 AND channel = $2 AND status = 'sent'
ORDER BY sent_at DESC
LIMIT 1;
