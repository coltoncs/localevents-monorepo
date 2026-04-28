-- name: GetPlace :one
SELECT * FROM places WHERE id = $1;

-- name: ListPlacesByLocation :many
SELECT *
FROM places
WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
    @radius_meters::float
)
AND (NOT @require_food::bool OR is_food)
AND (NOT @require_drink::bool OR is_drink)
AND (cardinality(@cuisines::text[]) = 0 OR (is_food AND cuisine = ANY(@cuisines::text[])))
AND (cardinality(@bar_types::text[]) = 0 OR (is_drink AND bar_type = ANY(@bar_types::text[])))
AND (sqlc.narg('min_price')::int IS NULL OR price_level >= sqlc.narg('min_price')::int)
AND (sqlc.narg('max_price')::int IS NULL OR price_level <= sqlc.narg('max_price')::int)
AND (sqlc.narg('search')::text IS NULL
     OR name ILIKE '%' || sqlc.narg('search')::text || '%'
     OR description ILIKE '%' || sqlc.narg('search')::text || '%'
     OR city ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY ST_Distance(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography
) ASC;

-- name: CreatePlace :one
INSERT INTO places (
    name, is_food, is_drink, cuisine, bar_type,
    address, city, state, zip,
    latitude, longitude, phone, website, hours,
    description, review, image_url, tags, price_level
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9,
    $10, $11, $12, $13, $14,
    $15, $16, $17, $18, $19
) RETURNING *;

-- name: UpdatePlace :one
UPDATE places SET
    name = $2,
    is_food = $3,
    is_drink = $4,
    cuisine = $5,
    bar_type = $6,
    address = $7,
    city = $8,
    state = $9,
    zip = $10,
    latitude = $11,
    longitude = $12,
    phone = $13,
    website = $14,
    hours = $15,
    description = $16,
    review = $17,
    image_url = $18,
    tags = $19,
    price_level = $20,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeletePlace :exec
DELETE FROM places WHERE id = $1;
