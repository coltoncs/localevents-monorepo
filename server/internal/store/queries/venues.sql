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

-- name: ListMusicVenuesByLocation :many
-- "Music venues" near a location: the union of venues explicitly tagged as
-- music venues (genre tags or a claimed profile) and venues that host upcoming
-- Music-category events (derived). Claimed venues sort first so managed
-- profiles surface above auto-discovered ones.
SELECT v.*
FROM venues v
WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
    @radius_meters::float
)
AND (
    v.is_claimed = TRUE
    OR (v.genres IS NOT NULL AND array_length(v.genres, 1) > 0)
    OR EXISTS (
        SELECT 1 FROM events e
        WHERE e.venue_id = v.id
          AND 'Music' = ANY(e.categories)
          AND e.start_time >= NOW()
    )
)
ORDER BY v.is_claimed DESC, v.name ASC;

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
INSERT INTO venues (
    name, address, city, state, zip, latitude, longitude, hours, description,
    genres, booking_email, accepts_booking_requests
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
    genres = $11,
    booking_email = $12,
    accepts_booking_requests = $13,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ClaimVenue :one
-- Links a venue to its owning user and marks it claimed. Used when a venue
-- claim is approved. Booking contact info comes from the claim.
UPDATE venues SET
    owner_user_id = @owner_user_id,
    is_claimed = TRUE,
    booking_email = COALESCE(NULLIF(@new_booking_email::text, ''), booking_email),
    accepts_booking_requests = @accepts_booking_requests,
    updated_at = NOW()
WHERE id = @id
RETURNING *;
