-- name: GetEvent :one
SELECT * FROM events WHERE id = $1;

-- name: GetEventsByIDs :many
SELECT * FROM events WHERE id = ANY($1::uuid[]);

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

-- name: ListFeaturedEventsByLocation :many
-- Upcoming featured events near a location, soonest first.
SELECT *
FROM events
WHERE is_featured = TRUE
AND start_time >= NOW()
AND ST_DWithin(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
    @radius_meters::float
)
ORDER BY start_time ASC,
    ST_Distance(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography
    ) ASC
LIMIT @event_limit;

-- name: FeatureEvent :one
UPDATE events SET is_featured = TRUE, featured_at = NOW(), featured_by = $2
WHERE id = $1
RETURNING *;

-- name: UnfeatureEvent :one
-- Keeps featured_at / featured_by as an audit trail.
UPDATE events SET is_featured = FALSE
WHERE id = $1
RETURNING *;

-- name: CountFeaturedThisMonth :one
-- Distinct events the user has featured this calendar month, excluding a given
-- event so re-featuring an already-counted event isn't double counted.
-- featured_at/featured_by are retained across un-feature, so consumed slots
-- aren't refunded.
SELECT COUNT(*) FROM events
WHERE featured_by = $1
  AND id <> $2
  AND featured_at >= date_trunc('month', now());

-- name: CountMyFeaturedThisMonth :one
-- Total distinct events the user has featured this calendar month (for the
-- quota display); same counting basis as CountFeaturedThisMonth, no exclusion.
SELECT COUNT(*) FROM events
WHERE featured_by = $1
  AND featured_at >= date_trunc('month', now());

-- name: ListMyFeaturedEvents :many
-- Events the user currently has featured, soonest first.
SELECT * FROM events
WHERE featured_by = $1 AND is_featured = TRUE
ORDER BY start_time ASC;

-- name: CreateEvent :one
INSERT INTO events (
    source, title, description, venue_name, address, city, state, zip,
    latitude, longitude, start_time, end_time, categories, image_url,
    ticket_url, price_min, price_max, is_free, submitted_by, venue_id, series_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14,
    $15, $16, $17, $18, $19, $20, $21
) RETURNING *;

-- name: ListEventsBySubmitter :many
SELECT * FROM events
WHERE submitted_by = $1
ORDER BY start_time ASC;

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
    is_free = $18,
    venue_id = $19,
    manually_edited = TRUE,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteEvent :exec
DELETE FROM events WHERE id = $1;

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
    ticket_url, price_min, price_max, is_free, venue_id
) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
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
    price_max=EXCLUDED.price_max, is_free=EXCLUDED.is_free,
    venue_id=EXCLUDED.venue_id, updated_at=NOW()
WHERE NOT events.manually_edited
RETURNING *;

-- name: ListEventsBySeries :many
SELECT * FROM events
WHERE series_id = $1
ORDER BY start_time ASC;

-- name: UpdateEventsBySeries :many
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
    categories = $11,
    image_url = $12,
    ticket_url = $13,
    price_min = $14,
    price_max = $15,
    is_free = $16,
    venue_id = $17,
    manually_edited = TRUE,
    updated_at = NOW()
WHERE series_id = $1
RETURNING *;
