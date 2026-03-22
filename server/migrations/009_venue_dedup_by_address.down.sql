-- Revert to coordinate-based dedup (cannot unmerge venues).
DROP INDEX idx_venues_name_addr;
CREATE UNIQUE INDEX idx_venues_name_location
    ON venues (LOWER(TRIM(name)), latitude, longitude);
