-- name: GetBeverage :one
SELECT * FROM beverages WHERE id = $1;

-- name: ListBeveragesByLocation :many
SELECT *
FROM beverages
WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
    @radius_meters::float
)
AND (NULLIF(@bev_type::text, '') IS NULL OR type = @bev_type)
AND (sqlc.narg('search')::text IS NULL
     OR name ILIKE '%' || sqlc.narg('search')::text || '%'
     OR description ILIKE '%' || sqlc.narg('search')::text || '%'
     OR city ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY ST_Distance(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography
) ASC;

-- name: CreateBeverage :one
INSERT INTO beverages (name, type, address, city, state, zip, latitude, longitude, phone, website, hours, description, review, image_url, tags, price_level)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
RETURNING *;

-- name: UpdateBeverage :one
UPDATE beverages SET
    name = $2,
    type = $3,
    address = $4,
    city = $5,
    state = $6,
    zip = $7,
    latitude = $8,
    longitude = $9,
    phone = $10,
    website = $11,
    hours = $12,
    description = $13,
    review = $14,
    image_url = $15,
    tags = $16,
    price_level = $17,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteBeverage :exec
DELETE FROM beverages WHERE id = $1;
