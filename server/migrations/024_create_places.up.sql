-- Create unified places table
CREATE TABLE places (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    is_food      BOOLEAN NOT NULL DEFAULT FALSE,
    is_drink     BOOLEAN NOT NULL DEFAULT FALSE,
    cuisine      TEXT,
    bar_type     TEXT CHECK (bar_type IS NULL OR bar_type IN ('brewery', 'bar')),
    address      TEXT,
    city         TEXT,
    state        TEXT,
    zip          TEXT,
    latitude     DOUBLE PRECISION NOT NULL,
    longitude    DOUBLE PRECISION NOT NULL,
    phone        TEXT,
    website      TEXT,
    hours        TEXT,
    description  TEXT,
    review       TEXT,
    image_url    TEXT,
    tags         TEXT[],
    price_level  INTEGER CHECK (price_level BETWEEN 1 AND 4),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT places_at_least_one_kind CHECK (is_food OR is_drink),
    CONSTRAINT places_food_has_cuisine CHECK (NOT is_food OR cuisine IS NOT NULL),
    CONSTRAINT places_drink_has_type CHECK (NOT is_drink OR bar_type IS NOT NULL)
);

CREATE INDEX idx_places_location ON places USING gist (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
CREATE INDEX idx_places_is_food ON places (is_food) WHERE is_food;
CREATE INDEX idx_places_is_drink ON places (is_drink) WHERE is_drink;

-- Create unified place_checkins table
CREATE TABLE place_checkins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id        UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    checkin_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    user_latitude   DOUBLE PRECISION NOT NULL,
    user_longitude  DOUBLE PRECISION NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, place_id, checkin_date)
);

CREATE INDEX idx_place_checkins_place ON place_checkins(place_id);
CREATE INDEX idx_place_checkins_user ON place_checkins(user_id);

-- Migrate foods -> places (preserve UUIDs)
INSERT INTO places (
    id, name, is_food, is_drink, cuisine,
    address, city, state, zip,
    latitude, longitude, phone, website, hours,
    description, review, image_url, tags, price_level,
    created_at, updated_at
)
SELECT
    id, name, TRUE, FALSE, cuisine,
    address, city, state, zip,
    latitude, longitude, phone, website, hours,
    description, review, image_url, tags, price_level,
    created_at, updated_at
FROM foods;

-- Migrate beverages -> places (preserve UUIDs)
-- IDs come from a separate table, so collisions with foods are not expected;
-- if a beverage somehow shares an id with a food, prefer keeping the food row
-- and skip — admins can re-create the drinks side via the UI.
INSERT INTO places (
    id, name, is_food, is_drink, bar_type,
    address, city, state, zip,
    latitude, longitude, phone, website, hours,
    description, review, image_url, tags, price_level,
    created_at, updated_at
)
SELECT
    id, name, FALSE, TRUE, type,
    address, city, state, zip,
    latitude, longitude, phone, website, hours,
    description, review, image_url, tags, price_level,
    created_at, updated_at
FROM beverages
ON CONFLICT (id) DO NOTHING;

-- Migrate food_checkins -> place_checkins
INSERT INTO place_checkins (
    id, user_id, place_id, checkin_date,
    user_latitude, user_longitude, created_at
)
SELECT
    id, user_id, food_id, checkin_date,
    user_latitude, user_longitude, created_at
FROM food_checkins
ON CONFLICT (user_id, place_id, checkin_date) DO NOTHING;

-- Migrate beverage_checkins -> place_checkins
INSERT INTO place_checkins (
    id, user_id, place_id, checkin_date,
    user_latitude, user_longitude, created_at
)
SELECT
    id, user_id, beverage_id, checkin_date,
    user_latitude, user_longitude, created_at
FROM beverage_checkins
ON CONFLICT (user_id, place_id, checkin_date) DO NOTHING;

-- Drop the old target_type CHECK constraint before migrating values, then re-add
-- the tighter constraint after — running the UPDATEs without a constraint avoids
-- transient violations (existing rows are 'food'/'beverage', new value is 'place').
ALTER TABLE edit_suggestions DROP CONSTRAINT IF EXISTS edit_suggestions_target_type_check;

-- Migrate edit_suggestions: 'food' -> 'place', stamp is_food=true
UPDATE edit_suggestions
SET target_type = 'place',
    proposed_changes = jsonb_set(proposed_changes, '{is_food}', 'true'::jsonb)
WHERE target_type = 'food';

-- Migrate edit_suggestions: 'beverage' -> 'place', rename type -> bar_type, stamp is_drink=true
UPDATE edit_suggestions
SET target_type = 'place',
    proposed_changes = jsonb_set(
        CASE
            WHEN proposed_changes ? 'type'
                THEN (proposed_changes - 'type') || jsonb_build_object('bar_type', proposed_changes -> 'type')
            ELSE proposed_changes
        END,
        '{is_drink}', 'true'::jsonb
    )
WHERE target_type = 'beverage';

ALTER TABLE edit_suggestions ADD CONSTRAINT edit_suggestions_target_type_check
    CHECK (target_type IN ('event', 'venue', 'place'));

-- Drop old tables
DROP TABLE food_checkins;
DROP TABLE beverage_checkins;
DROP TABLE foods;
DROP TABLE beverages;
