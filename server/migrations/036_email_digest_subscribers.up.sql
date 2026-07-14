-- Anonymous email-digest subscribers: people who sign up for the weekly digest
-- without a Clerk account. For authed users the digest reads email + location +
-- preferences from users + notification_preferences; this table is the
-- standalone equivalent for anonymous signups (no clerk_id, no FK into users).
--
-- Double opt-in: a row only receives digests once `confirmed` is TRUE, which
-- happens when the subscriber clicks the link mailed to them at signup.
CREATE TABLE IF NOT EXISTS email_digest_subscribers (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                TEXT NOT NULL UNIQUE,
    latitude             DOUBLE PRECISION NOT NULL,
    longitude            DOUBLE PRECISION NOT NULL,
    radius_miles         INT NOT NULL DEFAULT 25,
    preferred_categories TEXT[] NOT NULL DEFAULT '{}',
    digest_format        TEXT NOT NULL DEFAULT 'daily',
    email_style          TEXT NOT NULL DEFAULT 'detailed',
    confirmed            BOOLEAN NOT NULL DEFAULT FALSE,
    confirm_token        UUID NOT NULL DEFAULT gen_random_uuid(),
    unsubscribe_token    UUID NOT NULL DEFAULT gen_random_uuid(),
    last_sent_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at         TIMESTAMPTZ
);

-- The weekly digest only pulls confirmed subscribers.
CREATE INDEX IF NOT EXISTS idx_email_digest_subscribers_confirmed
    ON email_digest_subscribers (confirmed) WHERE confirmed;
