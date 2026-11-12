CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','teacher')), name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, teacher_id INTEGER REFERENCES users(id), monthly_fee INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS enrollments (student_id INTEGER NOT NULL REFERENCES students(id), group_id INTEGER NOT NULL REFERENCES groups(id), PRIMARY KEY(student_id,group_id));
CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES groups(id), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, room TEXT);
CREATE TABLE IF NOT EXISTS attendance (lesson_id INTEGER NOT NULL REFERENCES lessons(id), student_id INTEGER NOT NULL REFERENCES students(id), status TEXT NOT NULL CHECK(status IN ('present','absent','late')), PRIMARY KEY(lesson_id,student_id));
CREATE TABLE IF NOT EXISTS grades (lesson_id INTEGER NOT NULL REFERENCES lessons(id), student_id INTEGER NOT NULL REFERENCES students(id), grade REAL NOT NULL CHECK(grade BETWEEN 0 AND 100), PRIMARY KEY(lesson_id,student_id));
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), amount INTEGER NOT NULL CHECK(amount > 0), paid_at TEXT NOT NULL, note TEXT);
CREATE TABLE IF NOT EXISTS sessions (id_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rewards (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cost INTEGER NOT NULL CHECK(cost > 0), active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS point_awards (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), points INTEGER NOT NULL CHECK(points > 0), reason TEXT NOT NULL DEFAULT '', awarded_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS redemptions (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), reward_id INTEGER NOT NULL REFERENCES rewards(id), points_spent INTEGER NOT NULL CHECK(points_spent > 0), created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS redemptions_student_idx ON redemptions(student_id);
CREATE INDEX IF NOT EXISTS point_awards_student_idx ON point_awards(student_id);



