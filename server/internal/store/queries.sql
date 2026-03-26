-- name: GetUserByClerkID :one
SELECT * FROM users WHERE clerk_id = $1;

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

-- name: GetEvent :one
SELECT * FROM events WHERE id = $1;

-- name: CountEventsByLocation :one
SELECT COUNT(*)
FROM events
WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
    @radius_meters::float
)
AND start_time >= @start_date::timestamptz
AND start_time < @end_date::timestamptz
AND (sqlc.narg('category')::text IS NULL OR sqlc.narg('category')::text = ANY(categories))
AND (sqlc.narg('venue_name')::text IS NULL OR venue_name = sqlc.narg('venue_name')::text)
AND (sqlc.narg('venue_id')::uuid IS NULL OR venue_id = sqlc.narg('venue_id')::uuid)
AND (sqlc.narg('search')::text IS NULL OR title ILIKE '%' || sqlc.narg('search')::text || '%' OR venue_name ILIKE '%' || sqlc.narg('search')::text || '%');

-- name: ListEventsByLocation :many
SELECT *
FROM events
WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
    @radius_meters::float
)
AND start_time >= @start_date::timestamptz
AND start_time < @end_date::timestamptz
AND (sqlc.narg('category')::text IS NULL OR sqlc.narg('category')::text = ANY(categories))
AND (sqlc.narg('venue_name')::text IS NULL OR venue_name = sqlc.narg('venue_name')::text)
AND (sqlc.narg('venue_id')::uuid IS NULL OR venue_id = sqlc.narg('venue_id')::uuid)
AND (sqlc.narg('search')::text IS NULL OR title ILIKE '%' || sqlc.narg('search')::text || '%' OR venue_name ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY ST_Distance(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography
) ASC, start_time ASC
LIMIT @event_limit OFFSET @event_offset;

-- name: ListEventsByLocationDateSorted :many
SELECT *
FROM events
WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
    @radius_meters::float
)
AND start_time >= @start_date::timestamptz
AND start_time < @end_date::timestamptz
AND (sqlc.narg('category')::text IS NULL OR sqlc.narg('category')::text = ANY(categories))
AND (sqlc.narg('venue_name')::text IS NULL OR venue_name = sqlc.narg('venue_name')::text)
AND (sqlc.narg('venue_id')::uuid IS NULL OR venue_id = sqlc.narg('venue_id')::uuid)
AND (sqlc.narg('search')::text IS NULL OR title ILIKE '%' || sqlc.narg('search')::text || '%' OR venue_name ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY (start_time AT TIME ZONE 'America/New_York')::date ASC,
    ST_Distance(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography
    ) ASC,
    start_time ASC
LIMIT @event_limit OFFSET @event_offset;

-- name: CreateEvent :one
INSERT INTO events (
    source, title, description, venue_name, address, city, state, zip,
    latitude, longitude, start_time, end_time, categories, image_url,
    ticket_url, price_min, price_max, submitted_by, venue_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14,
    $15, $16, $17, $18, $19
) RETURNING *;

-- name: ListEventsBySubmitter :many
SELECT * FROM events
WHERE submitted_by = $1
ORDER BY start_time ASC;

-- name: ListSavedEvents :many
SELECT e.*
FROM events e
JOIN saved_events se ON se.event_id = e.id
WHERE se.user_id = $1
ORDER BY e.start_time ASC;

-- name: ListSavedEventsForDigest :many
SELECT e.*
FROM events e
JOIN saved_events se ON se.event_id = e.id
WHERE se.user_id = $1
  AND e.start_time >= @start_date::timestamptz
  AND e.start_time < @end_date::timestamptz
ORDER BY e.start_time ASC;

-- name: SaveEvent :one
INSERT INTO saved_events (user_id, event_id)
VALUES ($1, $2)
ON CONFLICT (user_id, event_id) DO NOTHING
RETURNING *;

-- name: UnsaveEvent :exec
DELETE FROM saved_events WHERE user_id = $1 AND event_id = $2;

-- name: GetEventSaveCount :one
SELECT COUNT(*) FROM saved_events WHERE event_id = $1;

-- name: DeletePastEvents :execrows
DELETE FROM events
WHERE start_time < NOW()::date;

-- name: ListPastEventImageURLs :many
SELECT DISTINCT image_url
FROM events
WHERE start_time < NOW()::date
  AND image_url IS NOT NULL
  AND image_url LIKE '%/events/%'
  AND image_url NOT IN (
      SELECT image_url FROM events
      WHERE start_time >= NOW()::date
        AND image_url IS NOT NULL
  );

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: UpdateEvent :one
UPDATE events SET
    title = $2,
    description = $3,
    venue_name = $4,
    address = $5,
    city = $6,
    state = $7,
    zip = $8,
    latitude = $9,
    longitude = $10,
    start_time = $11,
    end_time = $12,
    categories = $13,
    image_url = $14,
    ticket_url = $15,
    price_min = $16,
    price_max = $17,
    venue_id = $18,
    manually_edited = TRUE,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteEvent :exec
DELETE FROM events WHERE id = $1;

-- name: CreateAuthorApplication :one
INSERT INTO author_applications (clerk_id, full_name, email, bio, experience)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetAuthorApplicationByClerkID :one
SELECT * FROM author_applications
WHERE clerk_id = $1
ORDER BY submitted_at DESC
LIMIT 1;

-- name: GetAuthorApplication :one
SELECT * FROM author_applications WHERE id = $1;

-- name: ListPendingApplications :many
SELECT * FROM author_applications
WHERE status = 'pending'
ORDER BY submitted_at ASC;

-- name: ApproveApplication :one
UPDATE author_applications SET
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = $2,
    review_notes = $3
WHERE id = $1
RETURNING *;

-- name: RejectApplication :one
UPDATE author_applications SET
    status = 'rejected',
    reviewed_at = NOW(),
    reviewed_by = $2,
    review_notes = $3
WHERE id = $1
RETURNING *;

-- name: GetVenue :one
SELECT * FROM venues WHERE id = $1;

-- name: ListVenuesByLocation :many
SELECT *
FROM venues
WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
    @radius_meters::float
)
ORDER BY name ASC;

-- name: UpsertVenue :one
INSERT INTO venues (name, address, city, state, zip, latitude, longitude)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (LOWER(TRIM(name)), COALESCE(NULLIF(LOWER(TRIM(address)), ''), latitude::text || ',' || longitude::text))
DO UPDATE SET
    address = COALESCE(NULLIF(EXCLUDED.address, ''), venues.address),
    city = COALESCE(NULLIF(EXCLUDED.city, ''), venues.city),
    state = COALESCE(NULLIF(EXCLUDED.state, ''), venues.state),
    zip = COALESCE(NULLIF(EXCLUDED.zip, ''), venues.zip),
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = NOW()
RETURNING *;

-- name: CreateVenue :one
INSERT INTO venues (name, address, city, state, zip, latitude, longitude, hours, description)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateVenue :one
UPDATE venues SET
    name = $2,
    address = $3,
    city = $4,
    state = $5,
    zip = $6,
    latitude = $7,
    longitude = $8,
    hours = $9,
    description = $10,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CreateImage :one
INSERT INTO images (user_id, r2_key, url, filename, content_type, size_bytes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListImagesByUser :many
SELECT * FROM images
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetImage :one
SELECT * FROM images WHERE id = $1;

-- name: DeleteImage :exec
DELETE FROM images WHERE id = $1 AND user_id = $2;

-- name: TrackDeletedExternalEvent :exec
INSERT INTO deleted_external_events (source, external_id)
VALUES ($1, $2)
ON CONFLICT (source, external_id) DO NOTHING;

-- name: CleanOldDeletedExternalEvents :execrows
DELETE FROM deleted_external_events
WHERE deleted_at < NOW() - INTERVAL '90 days';

-- name: UpsertExternalEvent :one
INSERT INTO events (
    external_id, source, title, description, venue_name, address, city, state, zip,
    latitude, longitude, start_time, end_time, categories, image_url,
    ticket_url, price_min, price_max, venue_id
) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
WHERE NOT EXISTS (
    SELECT 1 FROM deleted_external_events d
    WHERE d.source = $2 AND d.external_id = $1
)
ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
    title=EXCLUDED.title, description=EXCLUDED.description,
    venue_name=EXCLUDED.venue_name, address=EXCLUDED.address,
    city=EXCLUDED.city, state=EXCLUDED.state, zip=EXCLUDED.zip,
    latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
    start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time,
    categories=EXCLUDED.categories, image_url=EXCLUDED.image_url,
    ticket_url=EXCLUDED.ticket_url, price_min=EXCLUDED.price_min,
    price_max=EXCLUDED.price_max, venue_id=EXCLUDED.venue_id, updated_at=NOW()
WHERE NOT events.manually_edited
RETURNING *;

-- name: ListEventIDsForSitemap :many
SELECT id, updated_at FROM events WHERE start_time >= NOW() ORDER BY start_time ASC;

-- name: ListVenueIDsForSitemap :many
SELECT id, updated_at FROM venues ORDER BY id ASC;

-- name: UpsertNotificationPreferences :one
INSERT INTO notification_preferences (user_id, email_enabled, sms_enabled, preferred_categories)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id) DO UPDATE SET
    email_enabled = EXCLUDED.email_enabled,
    sms_enabled = EXCLUDED.sms_enabled,
    preferred_categories = EXCLUDED.preferred_categories,
    updated_at = NOW()
RETURNING *;

-- name: GetNotificationPreferences :one
SELECT * FROM notification_preferences WHERE user_id = $1;

-- name: UpdateUserPhoneNumber :exec
UPDATE users SET phone_number = $2, updated_at = NOW() WHERE id = $1;

-- name: ListEmailSubscribers :many
SELECT u.id, u.email, u.default_latitude, u.default_longitude, u.default_radius_miles,
       np.email_unsubscribe_token, np.preferred_categories
FROM users u
JOIN notification_preferences np ON np.user_id = u.id
WHERE np.email_enabled = TRUE
  AND u.email IS NOT NULL
  AND u.default_latitude IS NOT NULL
  AND u.default_longitude IS NOT NULL;

-- name: GetEmailSubscriberByID :one
SELECT u.id, u.email, u.default_latitude, u.default_longitude, u.default_radius_miles,
       np.email_unsubscribe_token, np.preferred_categories
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
LIMIT 50;

-- name: CreateNotificationLog :exec
INSERT INTO notification_log (user_id, channel, event_count, status, error_message)
VALUES ($1, $2, $3, $4, $5);

-- name: GetLastNotificationSent :one
SELECT * FROM notification_log
WHERE user_id = $1 AND channel = $2 AND status = 'sent'
ORDER BY sent_at DESC
LIMIT 1;

-- Edit Suggestions

-- name: CreateEditSuggestion :one
INSERT INTO edit_suggestions (target_type, target_id, submitted_by, proposed_changes)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetEditSuggestion :one
SELECT * FROM edit_suggestions WHERE id = $1;

-- name: ListPendingEditSuggestions :many
SELECT * FROM edit_suggestions
WHERE status = 'pending'
ORDER BY created_at ASC;

-- name: ListPendingEditSuggestionsForTarget :many
SELECT * FROM edit_suggestions
WHERE target_type = $1 AND target_id = $2 AND status = 'pending'
ORDER BY created_at ASC;

-- name: ListPendingEditSuggestionsForAuthor :many
SELECT es.* FROM edit_suggestions es
JOIN events e ON es.target_type = 'event' AND es.target_id = e.id
JOIN users u ON e.submitted_by = u.id
WHERE u.clerk_id = $1 AND es.status = 'pending'
ORDER BY es.created_at ASC;

-- name: ApproveEditSuggestion :one
UPDATE edit_suggestions SET
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = $2,
    review_notes = $3
WHERE id = $1
RETURNING *;

-- name: RejectEditSuggestion :one
UPDATE edit_suggestions SET
    status = 'rejected',
    reviewed_at = NOW(),
    reviewed_by = $2,
    review_notes = $3
WHERE id = $1
RETURNING *;
