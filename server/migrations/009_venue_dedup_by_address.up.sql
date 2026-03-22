-- Merge duplicate venues: same name + same address become one record.
-- For venues without an address, fall back to coordinates for dedup.

-- Step 1: Build a mapping from duplicate venue IDs to the surviving (oldest) venue ID.
CREATE TEMP TABLE venue_merge AS
WITH ranked AS (
    SELECT id,
           LOWER(TRIM(name)) AS norm_name,
           COALESCE(NULLIF(LOWER(TRIM(address)), ''), latitude::text || ',' || longitude::text) AS norm_addr,
           ROW_NUMBER() OVER (
               PARTITION BY LOWER(TRIM(name)),
                            COALESCE(NULLIF(LOWER(TRIM(address)), ''), latitude::text || ',' || longitude::text)
               ORDER BY created_at ASC
           ) AS rn
    FROM venues
),
survivors AS (
    SELECT norm_name, norm_addr, id AS survivor_id
    FROM ranked WHERE rn = 1
)
SELECT r.id AS old_id, s.survivor_id
FROM ranked r
JOIN survivors s ON r.norm_name = s.norm_name AND r.norm_addr = s.norm_addr
WHERE r.id != s.survivor_id;

-- Step 2: Point events at the surviving venue.
UPDATE events e
SET venue_id = vm.survivor_id
FROM venue_merge vm
WHERE e.venue_id = vm.old_id;

-- Step 3: Delete the duplicate venues.
DELETE FROM venues WHERE id IN (SELECT old_id FROM venue_merge);

DROP TABLE venue_merge;

-- Step 4: Replace the unique index.
DROP INDEX idx_venues_name_location;
CREATE UNIQUE INDEX idx_venues_name_addr
    ON venues (
        LOWER(TRIM(name)),
        COALESCE(NULLIF(LOWER(TRIM(address)), ''), latitude::text || ',' || longitude::text)
    );
