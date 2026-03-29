DROP INDEX IF EXISTS idx_events_series_id;
ALTER TABLE events DROP COLUMN IF EXISTS series_id;
