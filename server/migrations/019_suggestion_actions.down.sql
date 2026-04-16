DROP INDEX IF EXISTS idx_edit_suggestions_action;

ALTER TABLE edit_suggestions
    DROP CONSTRAINT IF EXISTS edit_suggestions_delete_reason_ck,
    DROP CONSTRAINT IF EXISTS edit_suggestions_target_action_ck,
    DROP CONSTRAINT IF EXISTS edit_suggestions_target_type_check;

ALTER TABLE edit_suggestions
    ADD CONSTRAINT edit_suggestions_target_type_check
        CHECK (target_type IN ('event', 'venue'));

DELETE FROM edit_suggestions WHERE target_id IS NULL;

ALTER TABLE edit_suggestions
    ALTER COLUMN target_id SET NOT NULL;

ALTER TABLE edit_suggestions
    DROP COLUMN IF EXISTS reason,
    DROP COLUMN IF EXISTS action;
