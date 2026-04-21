CREATE TABLE IF NOT EXISTS food_checkins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_id         UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    checkin_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    user_latitude   DOUBLE PRECISION NOT NULL,
    user_longitude  DOUBLE PRECISION NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, food_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_food_checkins_food ON food_checkins(food_id);
CREATE INDEX IF NOT EXISTS idx_food_checkins_user ON food_checkins(user_id);
