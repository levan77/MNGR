-- Migration 005: Add professional portal credentials to staff
ALTER TABLE staff ADD COLUMN pro_username TEXT;
ALTER TABLE staff ADD COLUMN pro_password TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_pro_username ON staff(pro_username)
  WHERE pro_username IS NOT NULL;
