CREATE EXTENSION IF NOT EXISTS vector;

-- Event embeddings live in their own table so the vector column does not
-- pollute SELECT * on events (sqlc-generated code does not know vector).
CREATE TABLE event_embeddings (
    event_id   UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    embedding  vector(1536) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_embeddings_hnsw
    ON event_embeddings USING hnsw (embedding vector_cosine_ops);

-- User preference vector, recomputed lazily from saves + views.
CREATE TABLE user_preferences (
    user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preference_vector vector(1536),
    signal_count      INT NOT NULL DEFAULT 0,
    needs_recompute   BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_needs_recompute
    ON user_preferences (needs_recompute) WHERE needs_recompute;

-- Soft-signal: card impressions. Hard signal lives in saved_events.
CREATE TABLE event_views (
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id  UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, event_id)
);

CREATE INDEX idx_event_views_user ON event_views (user_id, viewed_at DESC);
