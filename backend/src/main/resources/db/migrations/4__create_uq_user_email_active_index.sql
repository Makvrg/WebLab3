CREATE UNIQUE INDEX IF NOT EXISTS uq_user_email_active
    ON "user" (email)
    WHERE is_deleted = FALSE;
