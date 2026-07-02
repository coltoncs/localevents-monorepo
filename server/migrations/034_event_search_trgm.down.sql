DROP INDEX IF EXISTS idx_events_venue_name_trgm;
DROP INDEX IF EXISTS idx_events_title_trgm;
-- intentionally do not drop the pg_trgm extension; another feature may use it.
