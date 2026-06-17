-- Many-to-many link between events and artists (a concert lineup). Cascades on
-- both sides so event cleanup and artist deletion drop their links.
CREATE TABLE IF NOT EXISTS event_artists (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    is_headliner BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (event_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_event_artists_artist ON event_artists (artist_id);
