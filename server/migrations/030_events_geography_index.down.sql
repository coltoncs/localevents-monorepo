-- Restore the original geometry index and drop the geography index.
CREATE INDEX IF NOT EXISTS idx_events_location ON events USING gist (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);

DROP INDEX IF EXISTS idx_events_location_geog;
