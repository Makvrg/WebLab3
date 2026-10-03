CREATE TABLE IF NOT EXISTS student (
    student_id SERIAL PRIMARY KEY,
    isuId INTEGER NOT NULL UNIQUE,
    fio VARCHAR(100) NOT NULL,
    "group" VARCHAR(5) NOT NULL,
    dormitory_number SMALLINT NOT NULL,
    room SMALLINT NOT NULL,
    date_of_placement DATE NOT NULL,
    is_not_russian BOOLEAN NOT NULL,
    notes TEXT,
    is_deleted BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS "user" (
    user_id SERIAL PRIMARY KEY,
    login VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    role VARCHAR(40) NOT NULL,
    hashed_password TEXT NOT NULL,
    salt TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL
);

CREATE TABLE refresh_token (
    refresh_token_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    hashed_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_deleted BOOLEAN NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES "user" (user_id)
);
