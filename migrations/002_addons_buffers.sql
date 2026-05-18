-- service add-ons (sub-categories)
CREATE TABLE IF NOT EXISTS service_addons (
  id            TEXT PRIMARY KEY,
  service_id    TEXT NOT NULL,
  department_id TEXT NOT NULL,
  name          TEXT NOT NULL,
  duration      INTEGER NOT NULL DEFAULT 15,
  price         INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_addons_service ON service_addons(service_id);
CREATE INDEX IF NOT EXISTS idx_addons_dept    ON service_addons(department_id);

-- per-specialist extra buffer after each appointment
ALTER TABLE staff    ADD COLUMN buffer_extra INTEGER NOT NULL DEFAULT 0;

-- snapshot of selected add-ons at booking time (JSON)
ALTER TABLE bookings ADD COLUMN addons TEXT NOT NULL DEFAULT '[]';
