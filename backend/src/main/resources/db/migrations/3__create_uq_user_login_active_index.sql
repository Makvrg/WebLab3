CREATE UNIQUE INDEX IF NOT EXISTS uq_user_login_active
    ON "user" (login)
    WHERE is_deleted = FALSE;
