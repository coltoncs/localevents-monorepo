-- An event is only labeled "Free" when explicitly tagged as such. Absence of
-- price data (price_min/price_max NULL) means the price is unknown, not free.
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT FALSE;
