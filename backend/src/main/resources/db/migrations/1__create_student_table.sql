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
