ALTER TABLE events ADD COLUMN categories TEXT[];
UPDATE events SET categories = ARRAY[category] WHERE category IS NOT NULL;
UPDATE events SET categories = '{}' WHERE categories IS NULL;
ALTER TABLE events ALTER COLUMN categories SET DEFAULT '{}';
ALTER TABLE events DROP COLUMN category;
