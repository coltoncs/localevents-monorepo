-- name: GetArtist :one
SELECT * FROM artists WHERE id = $1;

-- name: GetArtistByName :one
SELECT * FROM artists WHERE LOWER(TRIM(name)) = LOWER(TRIM(@name::text));

-- name: ListArtistsByOwner :many
SELECT * FROM artists WHERE owner_user_id = $1 ORDER BY name ASC;

-- name: ListArtistsByLocation :many
-- Artists with an upcoming event near a location (optionally filtered by genre).
-- "Playing in the area" — only artists with a future show in range appear.
SELECT DISTINCT a.*
FROM artists a
JOIN event_artists ea ON ea.artist_id = a.id
JOIN events e ON e.id = ea.event_id
WHERE e.start_time >= NOW()
AND ST_DWithin(
    ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(@lng::float, @lat::float), 4326)::geography,
    @radius_meters::float
)
AND (sqlc.narg('genre')::text IS NULL OR sqlc.narg('genre')::text = ANY(a.genres))
ORDER BY a.name ASC;

-- name: ListUpcomingEventsForArtist :many
SELECT e.*
FROM events e
JOIN event_artists ea ON ea.event_id = e.id
WHERE ea.artist_id = $1 AND e.start_time >= NOW()
ORDER BY e.start_time ASC;

-- name: CreateArtist :one
-- Self-serve create OR claim-an-existing-stub by name. On conflict the row is
-- updated and ownership set, but ONLY when it's unowned or already owned by the
-- same user; a name owned by someone else updates zero rows (RETURNING is empty,
-- surfaced as a conflict by the handler).
INSERT INTO artists (
    name, bio, genres, image_url, website_url, spotify_url, instagram_url,
    bandcamp_url, youtube_url, hometown_city, hometown_state,
    owner_user_id, source, is_claimed
)
VALUES (
    @name, @bio, @genres, @image_url, @website_url, @spotify_url, @instagram_url,
    @bandcamp_url, @youtube_url, @hometown_city, @hometown_state,
    @owner_user_id, 'user', TRUE
)
ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET
    bio = EXCLUDED.bio,
    genres = EXCLUDED.genres,
    image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), artists.image_url),
    website_url = EXCLUDED.website_url,
    spotify_url = EXCLUDED.spotify_url,
    instagram_url = EXCLUDED.instagram_url,
    bandcamp_url = EXCLUDED.bandcamp_url,
    youtube_url = EXCLUDED.youtube_url,
    hometown_city = EXCLUDED.hometown_city,
    hometown_state = EXCLUDED.hometown_state,
    owner_user_id = EXCLUDED.owner_user_id,
    is_claimed = TRUE,
    updated_at = NOW()
WHERE artists.owner_user_id IS NULL OR artists.owner_user_id = EXCLUDED.owner_user_id
RETURNING *;

-- name: UpdateArtist :one
UPDATE artists SET
    name = $2,
    bio = $3,
    genres = $4,
    image_url = $5,
    website_url = $6,
    spotify_url = $7,
    instagram_url = $8,
    bandcamp_url = $9,
    youtube_url = $10,
    hometown_city = $11,
    hometown_state = $12,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteArtist :exec
-- event_artists rows cascade away via the FK ON DELETE CASCADE.
DELETE FROM artists WHERE id = $1;

-- name: UpsertArtistStub :one
-- Dedup-by-name upsert for scraper-recovered lineup artists. Never clobbers an
-- existing (possibly user-owned) row's profile fields.
INSERT INTO artists (name, source, external_id)
VALUES (@name, @source, @external_id)
ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET updated_at = NOW()
RETURNING *;

-- name: LinkEventArtist :exec
INSERT INTO event_artists (event_id, artist_id, position, is_headliner)
VALUES ($1, $2, $3, $4)
ON CONFLICT (event_id, artist_id) DO NOTHING;

-- name: ListArtistsForEvent :many
SELECT a.*
FROM artists a
JOIN event_artists ea ON ea.artist_id = a.id
WHERE ea.event_id = $1
ORDER BY ea.is_headliner DESC, ea.position ASC, a.name ASC;
