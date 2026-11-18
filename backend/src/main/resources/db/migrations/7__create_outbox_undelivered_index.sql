CREATE INDEX IF NOT EXISTS idx_outbox_undelivered
    ON outbox_event (created_at)
    WHERE delivered_at IS NULL;
