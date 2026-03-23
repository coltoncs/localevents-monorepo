ALTER TABLE events ADD COLUMN category TEXT;
UPDATE events SET category = categories[1];
ALTER TABLE events DROP COLUMN categories;
