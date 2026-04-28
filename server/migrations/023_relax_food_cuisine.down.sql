ALTER TABLE foods ADD CONSTRAINT foods_cuisine_check CHECK (cuisine IN (
    'american','italian','mexican','chinese','japanese','korean','thai',
    'vietnamese','indian','mediterranean','middle_eastern','french',
    'bbq','pizza','seafood','vegan','cafe','bakery','dessert','other'
));
