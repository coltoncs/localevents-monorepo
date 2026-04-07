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
