CREATE TABLE cron_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    items_affected INT NOT NULL DEFAULT 0,
    details JSONB
);

CREATE INDEX idx_cron_log_job_name_ran_at ON cron_log(job_name, ran_at DESC);
