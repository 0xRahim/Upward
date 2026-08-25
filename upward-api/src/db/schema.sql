PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_url    TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS courses (
  id               TEXT PRIMARY KEY,
  category_id      TEXT NOT NULL REFERENCES categories (id),
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT NOT NULL,
  cover_image_url  TEXT,
  level            TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  language         TEXT NOT NULL DEFAULT 'en',
  rating           REAL NOT NULL DEFAULT 0,
  review_count     INTEGER NOT NULL DEFAULT 0,
  student_count    INTEGER NOT NULL DEFAULT 0,
  is_published     INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_courses_category ON courses (category_id);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses (is_published);

CREATE TABLE IF NOT EXISTS modules (
  id         TEXT PRIMARY KEY,
  course_id  TEXT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_modules_course ON modules (course_id, position);

CREATE TABLE IF NOT EXISTS lessons (
  id                TEXT PRIMARY KEY,
  module_id         TEXT NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('video', 'text', 'quiz')),
  content_url       TEXT,
  content           TEXT,
  duration_minutes  INTEGER,
  position          INTEGER NOT NULL DEFAULT 1,
  is_previewable    INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons (module_id, position);

CREATE TABLE IF NOT EXISTS bundles (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT NOT NULL,
  cover_image_url TEXT,
  is_published    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS bundle_courses (
  bundle_id TEXT NOT NULL REFERENCES bundles (id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  position  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (bundle_id, course_id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id      TEXT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  bundle_id      TEXT REFERENCES bundles (id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  last_lesson_id TEXT,
  enrolled_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at   TEXT,
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments (user_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments (course_id);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  lesson_id    TEXT NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress (user_id);

CREATE TABLE IF NOT EXISTS reviews (
  id             TEXT PRIMARY KEY,
  course_id      TEXT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  helpful_votes  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews (course_id);

CREATE TABLE IF NOT EXISTS review_votes (
  review_id  TEXT NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (review_id, user_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id  TEXT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  issued_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, course_id)
);
