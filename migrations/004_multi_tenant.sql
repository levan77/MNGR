-- Migration 004: Multi-tenant SaaS — Salons + Branches
-- Additive only — no existing data is modified or removed.

-- 1. Extend salons with subscription fields
ALTER TABLE salons ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE salons ADD COLUMN subscription_plan   TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE salons ADD COLUMN owner_email         TEXT;

-- 2. Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id         TEXT PRIMARY KEY,
  salon_id   TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  city       TEXT,
  address    TEXT,
  phone      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_branches_salon ON branches(salon_id);

-- 3. Seed one branch per existing salon.
--    branch.id = salon.id so all existing department_id references remain valid.
INSERT OR IGNORE INTO branches (id, salon_id, name, slug, city, address)
SELECT id, id, name, slug, city, address FROM salons;
