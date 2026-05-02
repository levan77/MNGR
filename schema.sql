CREATE TABLE IF NOT EXISTS services (
  id           TEXT PRIMARY KEY,
  department_id TEXT NOT NULL,
  name         TEXT NOT NULL,
  tagline      TEXT NOT NULL DEFAULT '',
  duration     INTEGER NOT NULL DEFAULT 60,
  buffer       INTEGER NOT NULL DEFAULT 10,
  price        INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff (
  id            TEXT PRIMARY KEY,
  department_id TEXT NOT NULL,
  name          TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT 'Stylist',
  avatar        TEXT NOT NULL DEFAULT '',
  specialties   TEXT NOT NULL DEFAULT '[]',
  working_hours TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id              TEXT PRIMARY KEY,
  department_id   TEXT NOT NULL,
  professional_id TEXT NOT NULL,
  service_id      TEXT NOT NULL,
  date            TEXT NOT NULL,
  time            TEXT NOT NULL,
  client_name     TEXT NOT NULL,
  client_phone    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'scheduled',
  reference       TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_services_dept  ON services(department_id);
CREATE INDEX IF NOT EXISTS idx_staff_dept     ON staff(department_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dept  ON bookings(department_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date  ON bookings(date);
