DROP INDEX IF EXISTS idx_events_featured_by_month;
ALTER TABLE events DROP COLUMN IF EXISTS featured_by;
