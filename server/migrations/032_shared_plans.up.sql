-- shared_plans holds public, token-addressable snapshots of an itinerary so a
-- user can share a link that reproduces exactly what they saw. The plan is a
-- denormalized JSONB copy (same shape as daily_plans.plan); created_by is
-- nullable so anonymous visitors can share too.
CREATE TABLE shared_plans (
    token      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan       JSONB NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supports future age-based cleanup of stale shared snapshots.
CREATE INDEX idx_shared_plans_created_at ON shared_plans (created_at);
