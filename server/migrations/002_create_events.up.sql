CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT,
    source TEXT NOT NULL DEFAULT 'user',
    title TEXT NOT NULL,
    description TEXT,
    venue_name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    category TEXT,
    image_url TEXT,
    ticket_url TEXT,
    price_min NUMERIC(10,2),
    price_max NUMERIC(10,2),
    submitted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_location ON events USING gist (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_external ON events(source, external_id) WHERE external_id IS NOT NULL;
