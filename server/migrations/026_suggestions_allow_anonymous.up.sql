-- Allow anonymous (unauthenticated) submissions to the review queue.
-- A NULL submitted_by means the suggestion was submitted without a signed-in user.
ALTER TABLE edit_suggestions
    ALTER COLUMN submitted_by DROP NOT NULL;
