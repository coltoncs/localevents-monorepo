ALTER TABLE edit_suggestions
    ADD COLUMN action TEXT NOT NULL DEFAULT 'edit'
        CHECK (action IN ('edit', 'create', 'delete')),
    ADD COLUMN reason TEXT;

ALTER TABLE edit_suggestions
    ALTER COLUMN target_id DROP NOT NULL;

ALTER TABLE edit_suggestions
    DROP CONSTRAINT IF EXISTS edit_suggestions_target_type_check;

ALTER TABLE edit_suggestions
    ADD CONSTRAINT edit_suggestions_target_type_check
        CHECK (target_type IN ('event', 'venue', 'beverage'));

ALTER TABLE edit_suggestions
    ADD CONSTRAINT edit_suggestions_target_action_ck CHECK (
        (action = 'create' AND target_id IS NULL) OR
        (action IN ('edit', 'delete') AND target_id IS NOT NULL)
    );

ALTER TABLE edit_suggestions
    ADD CONSTRAINT edit_suggestions_delete_reason_ck CHECK (
        action <> 'delete' OR (reason IS NOT NULL AND length(reason) > 0)
    );

CREATE INDEX idx_edit_suggestions_action ON edit_suggestions(action);
