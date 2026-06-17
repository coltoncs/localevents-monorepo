-- Music genre tags for events, parallel to categories. Populated from source
-- classifications (Ticketmaster genre/subgenre, SeatGeek performer genres) and
-- by user submissions. Used by the Music/Concerts section's genre filter.
-- Like categories, it's filtered with `= ANY(genre)` within a radius-bounded
-- set, so no dedicated index is needed.
--
-- Nullable (like categories) so inserts that omit it send NULL rather than
-- violating a NOT NULL constraint; reads come back as an empty slice.
ALTER TABLE events ADD COLUMN IF NOT EXISTS genre TEXT[] DEFAULT '{}';
