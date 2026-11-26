CREATE TABLE IF NOT EXISTS audit_log (
    event_id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action VARCHAR(32) NOT NULL,
    source VARCHAR(32) NOT NULL,
    actor_user_id INTEGER,
    actor_login VARCHAR(100),
    actor_role VARCHAR(40),
    isu_id INTEGER NOT NULL,
    before_state JSONB NULL,
    after_state JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
    ON audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_isu_id
    ON audit_log (isu_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_action
    ON audit_log (action);

CREATE INDEX IF NOT EXISTS idx_audit_log_source
    ON audit_log (source);
