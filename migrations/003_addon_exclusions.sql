-- Staff addon exclusions: marks which professionals CANNOT perform a specific add-on
CREATE TABLE IF NOT EXISTS staff_addon_exclusions (
  staff_id      TEXT NOT NULL,
  addon_id      TEXT NOT NULL,
  department_id TEXT NOT NULL,
  PRIMARY KEY (staff_id, addon_id)
);
CREATE INDEX IF NOT EXISTS idx_excl_addon  ON staff_addon_exclusions(addon_id);
CREATE INDEX IF NOT EXISTS idx_excl_staff  ON staff_addon_exclusions(staff_id);
CREATE INDEX IF NOT EXISTS idx_excl_dept   ON staff_addon_exclusions(department_id);
