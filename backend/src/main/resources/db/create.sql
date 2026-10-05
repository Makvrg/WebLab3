CREATE TABLE IF NOT EXISTS student (
    student_id SERIAL PRIMARY KEY,

    isu_id INTEGER NOT NULL UNIQUE,
    fio VARCHAR(100) NOT NULL,
    "group" VARCHAR(5) NOT NULL,
    dormitory_number SMALLINT NOT NULL,
    room SMALLINT NOT NULL,
    date_of_placement DATE NOT NULL,
    is_not_russian BOOLEAN NOT NULL,
    notes TEXT,

    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT chk_student_dormitory
       CHECK (dormitory_number > 0),
    CONSTRAINT chk_student_room
       CHECK (room > 0)
);

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

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_login_active
    ON "user" (login)
    WHERE is_deleted = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_email_active
    ON "user" (email)
    WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS refresh_token (
     refresh_token_id SERIAL PRIMARY KEY,

     user_id INTEGER NOT NULL,
     hashed_token TEXT NOT NULL UNIQUE,
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


CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id
    ON refresh_token (user_id);
