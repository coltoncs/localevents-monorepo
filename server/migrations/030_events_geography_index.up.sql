-- Fix the geospatial index on events.
--
-- The /api/events queries (ListEventsByLocation, ...DateSorted, the count, and
-- ListMap) filter with ST_DWithin and sort with ST_Distance on the *geography*
-- expression:
--     ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
-- but idx_events_location (migration 002) was built on the *geometry*
-- expression (no ::geography cast). A GiST index is only usable when its
-- indexed expression matches the predicate operand, so the geometry index was
-- never used: every request did a full sequential scan of events, computing a
-- geography distance per row. This got slower as the events table grew.
--
-- This index matches the geography expression so the planner can use it. The
-- old geometry index is dropped since nothing references it.
--
-- PRODUCTION: build this CONCURRENTLY *before/independently of* this migration,
-- because the migration runner wraps each file in a transaction and
-- CREATE/DROP INDEX CONCURRENTLY cannot run inside one. Run by hand:
--     CREATE INDEX CONCURRENTLY idx_events_location_geog ON events USING gist (
--         (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography));
--     DROP INDEX CONCURRENTLY IF EXISTS idx_events_location;
-- Then run VACUUM ANALYZE events; so the planner picks up the new index.
-- The statements below become no-ops once that is done, and keep fresh/local
-- databases (and schema_migrations) correct.

CREATE INDEX IF NOT EXISTS idx_events_location_geog ON events USING gist (
    (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
);

DROP INDEX IF EXISTS idx_events_location;
