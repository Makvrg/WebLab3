CREATE TABLE IF NOT EXISTS "user" (
      user_id SERIAL PRIMARY KEY,

      login VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL,
      role VARCHAR(40) NOT NULL,
      hashed_password TEXT NOT NULL,
      salt TEXT NOT NULL,

      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

      CONSTRAINT chk_user_login_not_empty
          CHECK (length(trim(login)) > 0),
      CONSTRAINT chk_user_email_not_empty
          CHECK (length(trim(email)) > 0)
);
