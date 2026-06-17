-- Venue claims: a user requests to manage a venue profile. Mirrors
-- author_applications (admin-approved). Two modes:
--   * Claim existing — venue_id set, references the venue being claimed.
--   * Propose new — venue_id null; the proposed venue's details are captured
--     here and the venue row is created on approval.
-- On approval the admin links the venue to the requesting user (sets
-- venues.owner_user_id / is_claimed) and applies the booking contact info.
CREATE TABLE IF NOT EXISTS venue_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id TEXT NOT NULL,
    venue_id UUID REFERENCES venues(id),

    -- Proposed venue details (used when venue_id is null = propose-new).
    venue_name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    -- Contact / booking info supplied by the claimant.
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    booking_email TEXT,
    message TEXT,

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_venue_claims_clerk_id ON venue_claims(clerk_id);
CREATE INDEX IF NOT EXISTS idx_venue_claims_status ON venue_claims(status);
