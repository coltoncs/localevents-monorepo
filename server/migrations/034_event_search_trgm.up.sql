-- Trigram indexes to keep the lexical half of hybrid search fast. Hybrid
-- search does ILIKE '%q%' on title/venue_name; without a trigram GIN index
-- those are sequential scans. pg_trgm makes them index-backed.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_events_title_trgm
    ON events USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_events_venue_name_trgm
    ON events USING gin (venue_name gin_trgm_ops);
