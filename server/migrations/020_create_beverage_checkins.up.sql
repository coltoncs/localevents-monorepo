CREATE TABLE IF NOT EXISTS beverage_checkins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    beverage_id     UUID NOT NULL REFERENCES beverages(id) ON DELETE CASCADE,
    checkin_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    user_latitude   DOUBLE PRECISION NOT NULL,
    user_longitude  DOUBLE PRECISION NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, beverage_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_beverage_checkins_beverage ON beverage_checkins(beverage_id);
CREATE INDEX IF NOT EXISTS idx_beverage_checkins_user ON beverage_checkins(user_id);
