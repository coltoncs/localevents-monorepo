DROP INDEX IF EXISTS idx_events_featured_upcoming;
ALTER TABLE events DROP COLUMN IF EXISTS featured_at;
ALTER TABLE events DROP COLUMN IF EXISTS is_featured;
