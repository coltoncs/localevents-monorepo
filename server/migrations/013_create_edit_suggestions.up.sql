CREATE TABLE edit_suggestions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type   TEXT NOT NULL CHECK (target_type IN ('event', 'venue')),
    target_id     UUID NOT NULL,
    submitted_by  UUID NOT NULL REFERENCES users(id),
    proposed_changes JSONB NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    review_notes  TEXT,
    reviewed_by   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at   TIMESTAMPTZ
);

CREATE INDEX idx_edit_suggestions_target ON edit_suggestions(target_type, target_id);
CREATE INDEX idx_edit_suggestions_status ON edit_suggestions(status);
CREATE INDEX idx_edit_suggestions_submitted_by ON edit_suggestions(submitted_by);
