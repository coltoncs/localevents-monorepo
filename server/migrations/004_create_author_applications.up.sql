CREATE TABLE IF NOT EXISTS author_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    bio TEXT NOT NULL,
    experience TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_author_applications_clerk_id ON author_applications(clerk_id);
CREATE INDEX IF NOT EXISTS idx_author_applications_status ON author_applications(status);
