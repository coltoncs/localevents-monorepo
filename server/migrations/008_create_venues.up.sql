-- Create venues table
CREATE TABLE venues (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    address     TEXT,
    city        TEXT,
    state       TEXT,
    zip         TEXT,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    hours       TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dedup: same name (case-insensitive) at same coordinates
CREATE UNIQUE INDEX idx_venues_name_location
    ON venues (LOWER(TRIM(name)), latitude, longitude);

-- Spatial index for radius queries
CREATE INDEX idx_venues_location ON venues USING gist (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);

-- FK on events
ALTER TABLE events ADD COLUMN venue_id UUID REFERENCES venues(id);
CREATE INDEX idx_events_venue_id ON events (venue_id);

-- Seed venues from existing events
INSERT INTO venues (name, address, city, state, zip, latitude, longitude)
SELECT DISTINCT ON (LOWER(TRIM(venue_name)), latitude, longitude)
    venue_name, address, city, state, zip, latitude, longitude
FROM events
WHERE venue_name IS NOT NULL AND venue_name != ''
ON CONFLICT DO NOTHING;

-- Link existing events to their venue
UPDATE events e SET venue_id = v.id
FROM venues v
WHERE e.venue_name IS NOT NULL AND e.venue_name != ''
  AND LOWER(TRIM(e.venue_name)) = LOWER(TRIM(v.name))
  AND e.latitude = v.latitude AND e.longitude = v.longitude;
