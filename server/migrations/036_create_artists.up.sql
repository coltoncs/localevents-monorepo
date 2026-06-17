-- Artists: musician/performer profiles. Populated both by self-serve user
-- submissions (source='user', owner set, is_claimed=true) and by scraper stubs
-- recovered from concert lineups (source='bandsintown', no owner). Deduped by
-- case-insensitive name so a stub and a later user profile collapse into one
-- row (a user claiming a stub's name takes ownership of it).
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    bio TEXT,
    genres TEXT[] DEFAULT '{}',
    image_url TEXT,
    website_url TEXT,
    spotify_url TEXT,
    instagram_url TEXT,
    bandcamp_url TEXT,
    youtube_url TEXT,
    hometown_city TEXT,
    hometown_state TEXT,
    owner_user_id UUID REFERENCES users(id),
    source TEXT NOT NULL DEFAULT 'user',
    external_id TEXT,
    is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_name ON artists (LOWER(TRIM(name)));
CREATE INDEX IF NOT EXISTS idx_artists_owner ON artists (owner_user_id);
