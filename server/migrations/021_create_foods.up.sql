CREATE TABLE foods (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    cuisine      TEXT NOT NULL CHECK (cuisine IN (
        'american','italian','mexican','chinese','japanese','korean','thai',
        'vietnamese','indian','mediterranean','middle_eastern','french',
        'bbq','pizza','seafood','vegan','cafe','bakery','dessert','other'
    )),
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
