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
