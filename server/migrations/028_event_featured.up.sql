-- Authors can "feature" an event to boost its visibility (badge + home page
-- section). featured_at records when it was last featured; it is not cleared
-- when un-featured, so it doubles as an audit/ordering signal.
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ;

-- Supports the home page "Featured" query (upcoming featured events).
CREATE INDEX IF NOT EXISTS idx_events_featured_upcoming ON events (start_time) WHERE is_featured;
