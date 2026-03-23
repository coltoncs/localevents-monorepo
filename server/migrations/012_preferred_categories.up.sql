ALTER TABLE notification_preferences ADD COLUMN preferred_categories TEXT[] NOT NULL DEFAULT '{}';
