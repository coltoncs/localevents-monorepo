-- Venue profiles: ownership (claimed via admin-approved venue_claims), booking
-- contact info, and music genre tags. Genres are nullable like events.genre so
-- inserts that omit them don't trip a NOT NULL constraint. owner_user_id links
-- a claimed venue to the user who manages it.
ALTER TABLE venues ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS booking_email TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS accepts_booking_requests BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS genres TEXT[] DEFAULT '{}';
