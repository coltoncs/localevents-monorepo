-- Featuring is now open to any subscribed user on any event (a sales funnel),
-- so record who featured each event. This powers the per-user monthly cap,
-- "events I featured" views, and restricting un-feature to the featurer.
ALTER TABLE events ADD COLUMN IF NOT EXISTS featured_by UUID REFERENCES users(id);

-- Preserve attribution for events featured under the previous model, where an
-- author could only feature their own events.
UPDATE events SET featured_by = submitted_by WHERE is_featured = TRUE AND featured_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_events_featured_by_month ON events (featured_by, featured_at);
