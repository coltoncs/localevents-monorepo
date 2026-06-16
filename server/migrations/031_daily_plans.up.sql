-- daily_plans stores a per-user weekly itinerary produced by the planner cron.
-- The plan is a denormalized JSONB snapshot so the read path is a single row
-- fetch and the itinerary stays stable even if an event is later edited or
-- deleted. One row per user per week window.
CREATE TABLE daily_plans (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_of      DATE NOT NULL,             -- start date of the plan window (ET)
    plan         JSONB NOT NULL,            -- { week_of, days: [{date, weekday, items:[...]}] }
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, week_of)
);

-- Serves "latest plan for this user" lookups from the /me/planner endpoint.
CREATE INDEX idx_daily_plans_user_latest ON daily_plans (user_id, week_of DESC);
