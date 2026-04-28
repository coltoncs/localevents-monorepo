-- Recreate beverages
CREATE TABLE beverages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('brewery', 'bar')),
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
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_beverages_location ON beverages USING gist (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
CREATE INDEX idx_beverages_type ON beverages (type);

-- Recreate foods (CHECK constraint omitted to match the post-023 state)
CREATE TABLE foods (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    cuisine      TEXT NOT NULL,
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
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_foods_location ON foods USING gist (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
CREATE INDEX idx_foods_cuisine ON foods (cuisine);

-- Recreate check-in tables
CREATE TABLE food_checkins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_id         UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    checkin_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    user_latitude   DOUBLE PRECISION NOT NULL,
    user_longitude  DOUBLE PRECISION NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, food_id, checkin_date)
);
CREATE INDEX idx_food_checkins_food ON food_checkins(food_id);
CREATE INDEX idx_food_checkins_user ON food_checkins(user_id);

CREATE TABLE beverage_checkins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    beverage_id     UUID NOT NULL REFERENCES beverages(id) ON DELETE CASCADE,
    checkin_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    user_latitude   DOUBLE PRECISION NOT NULL,
    user_longitude  DOUBLE PRECISION NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, beverage_id, checkin_date)
);
CREATE INDEX idx_beverage_checkins_beverage ON beverage_checkins(beverage_id);
CREATE INDEX idx_beverage_checkins_user ON beverage_checkins(user_id);

-- Restore foods rows
INSERT INTO foods (
    id, name, cuisine, address, city, state, zip,
    latitude, longitude, phone, website, hours,
    description, review, image_url, tags, price_level,
    created_at, updated_at
)
SELECT
    id, name, COALESCE(cuisine, 'other'),
    address, city, state, zip,
    latitude, longitude, phone, website, hours,
    description, review, image_url, tags, price_level,
    created_at, updated_at
FROM places
WHERE is_food;

-- Restore beverages rows
INSERT INTO beverages (
    id, name, type, address, city, state, zip,
    latitude, longitude, phone, website, hours,
    description, review, image_url, tags, price_level,
    created_at, updated_at
)
SELECT
    id, name, COALESCE(bar_type, 'bar'),
    address, city, state, zip,
    latitude, longitude, phone, website, hours,
    description, review, image_url, tags, price_level,
    created_at, updated_at
FROM places
WHERE is_drink;

-- Restore food_checkins (only those whose place still exists in foods)
INSERT INTO food_checkins (
    id, user_id, food_id, checkin_date,
    user_latitude, user_longitude, created_at
)
SELECT
    pc.id, pc.user_id, pc.place_id, pc.checkin_date,
    pc.user_latitude, pc.user_longitude, pc.created_at
FROM place_checkins pc
JOIN foods f ON f.id = pc.place_id;

-- Restore beverage_checkins (skip ones already restored to food side via id collision)
INSERT INTO beverage_checkins (
    id, user_id, beverage_id, checkin_date,
    user_latitude, user_longitude, created_at
)
SELECT
    pc.id, pc.user_id, pc.place_id, pc.checkin_date,
    pc.user_latitude, pc.user_longitude, pc.created_at
FROM place_checkins pc
JOIN beverages b ON b.id = pc.place_id
ON CONFLICT (id) DO NOTHING;

-- Restore edit_suggestions target_types and field shapes
UPDATE edit_suggestions
SET target_type = CASE
        WHEN (proposed_changes ->> 'is_drink')::bool IS TRUE THEN 'beverage'
        ELSE 'food'
    END,
    proposed_changes = (
        (proposed_changes - 'is_food' - 'is_drink')
        || CASE
            WHEN proposed_changes ? 'bar_type'
                THEN jsonb_build_object('type', proposed_changes -> 'bar_type')
            ELSE '{}'::jsonb
        END
    ) - 'bar_type'
WHERE target_type = 'place';

-- Restore CHECK constraint
ALTER TABLE edit_suggestions DROP CONSTRAINT IF EXISTS edit_suggestions_target_type_check;
ALTER TABLE edit_suggestions ADD CONSTRAINT edit_suggestions_target_type_check
    CHECK (target_type IN ('event', 'venue', 'beverage'));

-- Drop new tables
DROP TABLE place_checkins;
DROP TABLE places;
