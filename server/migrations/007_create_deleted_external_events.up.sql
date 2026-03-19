CREATE TABLE deleted_external_events (
    source     TEXT NOT NULL,
    external_id TEXT NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source, external_id)
);
