CREATE TABLE IF NOT EXISTS refresh_token (
     refresh_token_id SERIAL PRIMARY KEY,

     user_id INTEGER NOT NULL,
     hashed_token TEXT NOT NULL UNIQUE,
     salt TEXT NOT NULL,
     expires_at TIMESTAMPTZ NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
     is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

     CONSTRAINT fk_refresh_token_user
         FOREIGN KEY (user_id)
             REFERENCES "user" (user_id)
             ON DELETE CASCADE,
     CONSTRAINT chk_refresh_token_expiration
         CHECK (expires_at > created_at)
);
