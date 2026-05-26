-- Remove anonymous submissions before restoring the NOT NULL constraint.
DELETE FROM edit_suggestions WHERE submitted_by IS NULL;

ALTER TABLE edit_suggestions
    ALTER COLUMN submitted_by SET NOT NULL;
