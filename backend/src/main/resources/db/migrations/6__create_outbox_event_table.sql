CREATE TABLE IF NOT EXISTS outbox_event (
    event_id UUID PRIMARY KEY,

    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ NULL,
    retry_count INTEGER NOT NULL DEFAULT  0
);
