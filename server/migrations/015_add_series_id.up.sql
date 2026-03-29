ALTER TABLE events ADD COLUMN series_id UUID;
CREATE INDEX idx_events_series_id ON events(series_id) WHERE series_id IS NOT NULL;
