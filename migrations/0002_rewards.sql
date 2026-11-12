CREATE TABLE IF NOT EXISTS rewards (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cost INTEGER NOT NULL CHECK(cost > 0), active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS point_awards (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), points INTEGER NOT NULL CHECK(points > 0), reason TEXT NOT NULL DEFAULT '', awarded_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS redemptions (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), reward_id INTEGER NOT NULL REFERENCES rewards(id), points_spent INTEGER NOT NULL CHECK(points_spent > 0), created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS redemptions_student_idx ON redemptions(student_id);
CREATE INDEX IF NOT EXISTS point_awards_student_idx ON point_awards(student_id);

