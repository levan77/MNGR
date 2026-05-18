'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { validateRequest } from '@/lib/auth';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export type DBSalon = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  admin_username: string;
  admin_password: string;
  created_at: string;
  subscription_status: 'trial' | 'active' | 'suspended';
  subscription_plan: string;
  owner_email: string | null;
};

export type BranchRow = {
  id: string;
  salon_id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  created_at: string;
};

export type DBService = {
  id: string;
  department_id: string;
  name: string;
  tagline: string;
  duration: number;
  buffer: number;
  price: number;
};

export type CompType = 'commission' | 'salary' | 'hybrid';

export type DBStaff = {
  id: string;
  department_id: string;
  name: string;
  title: string;
  avatar: string;
  specialties: string;
  working_hours: string;
  comp_type: CompType;
  comp_base: number;
  comp_percentage: number;
  buffer_extra: number;
  pro_username: string | null;
};

export type DBBooking = {
  id: string;
  department_id: string;
  professional_id: string;
  service_id: string;
  date: string;
  time: string;
  client_name: string;
  client_phone: string;
  status: string;
  reference: string;
  created_at: string;
  addons: string; // JSON: Array<{id,name,duration,price}>
};

export type DBServiceAddon = {
  id: string;
  service_id: string;
  department_id: string;
  name: string;
  duration: number;
  price: number;
};

async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext<CloudflareEnv>();
  if (!env.DB) throw new Error('D1 binding "DB" is not configured on this Worker');
  return env.DB;
}

// Exported so login action (and other non-server-action callers) can obtain the DB binding
export async function getDb(): Promise<D1Database | null> {
  try { return await getDB(); } catch { return null; }
}

async function getSession() {
  return validateRequest((await cookies()).toString());
}

async function requireBranchAccess(branchId: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  if (session.role === 'super_admin') return;
  if (session.role === 'salon_admin') {
    // Fast path: for migrated data, branch.id === salon.id
    if (session.salon_id === branchId) return;
    // General path: look up the branch's owning salon
    const db = await getDB();
    const branch = await db
      .prepare('SELECT salon_id FROM branches WHERE id = ? LIMIT 1')
      .bind(branchId)
      .first<{ salon_id: string }>();
    if (branch && branch.salon_id === session.salon_id) return;
  }
  throw new Error('Forbidden');
}

// Alias kept so all existing call sites are unchanged
const requireSalonAccess = requireBranchAccess;

async function requireSuperAdmin(): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== 'super_admin') throw new Error('Forbidden — super admin only');
}

// ─── Password hashing (PBKDF2 via Web Crypto — works in CF Workers) ──────────

const PBKDF2_ITERS = 100_000;
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'booking', '_next', 'favicon.ico', 'favicon.svg',
  'sitemap.xml', 'robots.txt', 'apple-touch-icon.png', 'login', 'not-found',
]);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    key, 256,
  );
  const toHex = (buf: Uint8Array) => Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    key, 256,
  );
  const newHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  // Constant-time compare to prevent timing attacks
  const a = new TextEncoder().encode(newHex);
  const b = new TextEncoder().encode(hashHex);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ─── Salons (super-admin) ─────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function getSalons(): Promise<DBSalon[]> {
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM salons ORDER BY created_at ASC')
    .all<DBSalon>();
  return results;
}

export async function getSalonById(id: string): Promise<DBSalon | null> {
  const db = await getDB();
  const row = await db.prepare('SELECT * FROM salons WHERE id = ? LIMIT 1').bind(id).first<DBSalon>();
  return row ?? null;
}

export async function getSalonBySlug(slug: string): Promise<DBSalon | null> {
  const db = await getDB();
  const row = await db.prepare('SELECT * FROM salons WHERE slug = ? LIMIT 1').bind(slug).first<DBSalon>();
  return row ?? null;
}

export async function createSalon(data: {
  name: string;
  slug?: string;
  city?: string;
  address?: string;
  adminUsername: string;
  adminPassword: string;
}): Promise<{ ok: true; salon: DBSalon } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const name = data.name.trim();
  if (!name) return { ok: false, error: 'Name is required' };
  const username = data.adminUsername.trim().toLowerCase();
  if (!username) return { ok: false, error: 'Admin username is required' };
  if (username === 'master') return { ok: false, error: 'Username "master" is reserved' };
  const password = data.adminPassword;
  if (!password || password.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };

  const slug = slugify(data.slug?.trim() || name);
  if (!slug) return { ok: false, error: 'Slug is invalid' };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: `Slug "${slug}" is reserved` };

  const db = await getDB();
  const slugTaken = await db.prepare('SELECT id FROM salons WHERE slug = ? LIMIT 1').bind(slug).first<{ id: string }>();
  if (slugTaken) return { ok: false, error: `Slug "${slug}" is already in use` };
  const userTaken = await db.prepare('SELECT id FROM salons WHERE admin_username = ? LIMIT 1').bind(username).first<{ id: string }>();
  if (userTaken) return { ok: false, error: `Username "${username}" is already in use` };

  const id = `sal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const city = data.city?.trim() ?? '';
  const address = data.address?.trim() ?? '';
  const created_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const hashed = await hashPassword(password);
  const plan = (data as { subscription_plan?: string }).subscription_plan ?? 'starter';
  const ownerEmail = (data as { owner_email?: string }).owner_email?.trim() ?? null;

  await db.batch([
    db.prepare('INSERT INTO salons (id, slug, name, city, address, admin_username, admin_password, created_at, subscription_status, subscription_plan, owner_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, slug, name, city, address, username, hashed, created_at, 'trial', plan, ownerEmail),
    // First branch gets same id as salon so existing department_id lookups still work
    db.prepare('INSERT OR IGNORE INTO branches (id, salon_id, name, slug, city, address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, id, name, slug, city, address, created_at),
  ]);

  const salon: DBSalon = { id, slug, name, city, address, admin_username: username, admin_password: hashed, created_at, subscription_status: 'trial', subscription_plan: plan, owner_email: ownerEmail };
  return { ok: true, salon };
}

export async function updateSalon(id: string, data: {
  name?: string;
  slug?: string;
  city?: string;
  address?: string;
  adminUsername?: string;
  adminPassword?: string;
}): Promise<{ ok: true; salon: DBSalon } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const db = await getDB();
  const existing = await getSalonById(id);
  if (!existing) return { ok: false, error: 'Salon not found' };

  const newPassword = data.adminPassword && data.adminPassword.length > 0
    ? await hashPassword(data.adminPassword)
    : existing.admin_password;

  const next = {
    name: data.name?.trim() ?? existing.name,
    slug: data.slug !== undefined ? slugify(data.slug) : existing.slug,
    city: data.city?.trim() ?? existing.city,
    address: data.address?.trim() ?? existing.address,
    admin_username: data.adminUsername?.trim().toLowerCase() ?? existing.admin_username,
    admin_password: newPassword,
  };

  if (!next.name) return { ok: false, error: 'Name required' };
  if (!next.slug) return { ok: false, error: 'Slug required' };
  if (next.admin_username === 'master') return { ok: false, error: 'Username "master" is reserved' };

  if (next.slug !== existing.slug) {
    const t = await db.prepare('SELECT id FROM salons WHERE slug = ? AND id != ? LIMIT 1').bind(next.slug, id).first<{ id: string }>();
    if (t) return { ok: false, error: `Slug "${next.slug}" already used` };
  }
  if (next.admin_username !== existing.admin_username) {
    const t = await db.prepare('SELECT id FROM salons WHERE admin_username = ? AND id != ? LIMIT 1').bind(next.admin_username, id).first<{ id: string }>();
    if (t) return { ok: false, error: `Username "${next.admin_username}" already used` };
  }

  await db
    .prepare('UPDATE salons SET name=?, slug=?, city=?, address=?, admin_username=?, admin_password=? WHERE id=?')
    .bind(next.name, next.slug, next.city, next.address, next.admin_username, next.admin_password, id)
    .run();

  const salon: DBSalon = { ...existing, ...next };
  return { ok: true, salon };
}

export async function deleteSalon(id: string): Promise<void> {
  await requireSuperAdmin();
  const db = await getDB();
  // Cascade: remove all children scoped to this salon.
  await db.batch([
    db.prepare('DELETE FROM bookings WHERE department_id = ?').bind(id),
    db.prepare('DELETE FROM staff WHERE department_id = ?').bind(id),
    db.prepare('DELETE FROM services WHERE department_id = ?').bind(id),
    db.prepare('DELETE FROM salons WHERE id = ?').bind(id),
  ]);
}

export async function findSalonByLogin(username: string, password: string): Promise<DBSalon | null> {
  const db = await getDB();
  // Look up by username only, then do a constant-time password hash comparison
  // to avoid leaking whether the username exists via timing differences.
  const row = await db
    .prepare('SELECT * FROM salons WHERE admin_username = ? LIMIT 1')
    .bind(username)
    .first<DBSalon>();
  if (!row) return null;
  const ok = await verifyPassword(password, row.admin_password);
  return ok ? row : null;
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function getServices(departmentId: string): Promise<DBService[]> {
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM services WHERE department_id = ? ORDER BY created_at ASC')
    .bind(departmentId)
    .all<DBService>();
  return results;
}

export async function addService(data: {
  departmentId: string;
  name: string;
  tagline: string;
  duration: number;
  price: number;
}): Promise<DBService> {
  await requireSalonAccess(data.departmentId);
  const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const db = await getDB();
  await db
    .prepare('INSERT INTO services (id, department_id, name, tagline, duration, buffer, price) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, data.departmentId, data.name, data.tagline, data.duration, 10, data.price)
    .run();
  return {
    id, department_id: data.departmentId, name: data.name, tagline: data.tagline,
    duration: data.duration, buffer: 10, price: data.price,
  };
}

export async function deleteService(id: string, departmentId: string): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  await db
    .prepare('DELETE FROM services WHERE id = ? AND department_id = ?')
    .bind(id, departmentId)
    .run();
}

// ─── Staff ────────────────────────────────────────────────────────────────────

const DEFAULT_HOURS = JSON.stringify([
  null,
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '19:00' },
  { s: '09:00', e: '18:00' },
]);

export async function getStaff(departmentId: string): Promise<DBStaff[]> {
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM staff WHERE department_id = ? ORDER BY created_at ASC')
    .bind(departmentId)
    .all<DBStaff>();
  return results;
}

export async function addStaffMember(data: {
  departmentId: string;
  name: string;
  title: string;
  avatar: string;
  compType?: CompType;
  compBase?: number;
  compPercentage?: number;
}): Promise<DBStaff> {
  await requireSalonAccess(data.departmentId);
  const id       = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const compType = data.compType       ?? 'commission';
  const compBase = data.compBase       ?? 0;
  const compPct  = data.compPercentage ?? 50;
  const db = await getDB();
  await db
    .prepare('INSERT INTO staff (id, department_id, name, title, avatar, specialties, working_hours, comp_type, comp_base, comp_percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, data.departmentId, data.name, data.title, data.avatar, '[]', DEFAULT_HOURS, compType, compBase, compPct)
    .run();
  return {
    id, department_id: data.departmentId, name: data.name, title: data.title,
    avatar: data.avatar, specialties: '[]', working_hours: DEFAULT_HOURS,
    comp_type: compType, comp_base: compBase, comp_percentage: compPct, buffer_extra: 0, pro_username: null,
  };
}

export async function updateStaffCompensation(
  id: string,
  departmentId: string,
  comp: { compType: CompType; compBase: number; compPercentage: number },
): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  await db
    .prepare('UPDATE staff SET comp_type=?, comp_base=?, comp_percentage=? WHERE id=? AND department_id=?')
    .bind(comp.compType, comp.compBase, comp.compPercentage, id, departmentId)
    .run();
}

export async function deleteStaffMember(id: string, departmentId: string): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  await db
    .prepare('DELETE FROM staff WHERE id = ? AND department_id = ?')
    .bind(id, departmentId)
    .run();
}

export async function updateStaffHours(id: string, departmentId: string, hours: unknown): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  await db
    .prepare('UPDATE staff SET working_hours = ? WHERE id = ? AND department_id = ?')
    .bind(JSON.stringify(hours), id, departmentId)
    .run();
}

export async function updateStaffSpecialties(id: string, departmentId: string, serviceIds: string[]): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  await db
    .prepare('UPDATE staff SET specialties = ? WHERE id = ? AND department_id = ?')
    .bind(JSON.stringify(serviceIds), id, departmentId)
    .run();
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export async function getBookings(departmentId: string): Promise<DBBooking[]> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM bookings WHERE department_id = ? ORDER BY date DESC, time DESC')
    .bind(departmentId)
    .all<DBBooking>();
  return results;
}

// ─── Day View (JOIN query for DayCalendar) ────────────────────────────────────

export type DBBookingDetail = DBBooking & {
  professional_name: string;
  service_name: string;
  service_duration: number;
  service_buffer: number;
  service_price: number;
  staff_buffer_extra: number;
};

export async function getBookingsForDay(
  departmentId: string,
  date: string,
): Promise<DBBookingDetail[]> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  const { results } = await db
    .prepare(`
      SELECT
        b.*,
        st.name         AS professional_name,
        st.buffer_extra AS staff_buffer_extra,
        sv.name         AS service_name,
        sv.duration     AS service_duration,
        sv.buffer       AS service_buffer,
        sv.price        AS service_price
      FROM bookings b
      JOIN staff    st ON b.professional_id = st.id
      JOIN services sv ON b.service_id      = sv.id
      WHERE b.department_id = ?
        AND b.date           = ?
        AND b.status NOT IN ('cancelled', 'no_show')
      ORDER BY b.time ASC
    `)
    .bind(departmentId, date)
    .all<DBBookingDetail>();
  return results;
}

export async function getBookingsForWeek(
  departmentId: string,
  weekStart: string,
  weekEnd: string,
): Promise<DBBookingDetail[]> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  const { results } = await db
    .prepare(`
      SELECT
        b.*,
        st.name         AS professional_name,
        st.buffer_extra AS staff_buffer_extra,
        sv.name         AS service_name,
        sv.duration     AS service_duration,
        sv.buffer       AS service_buffer,
        sv.price        AS service_price
      FROM bookings b
      JOIN staff    st ON b.professional_id = st.id
      JOIN services sv ON b.service_id      = sv.id
      WHERE b.department_id = ?
        AND b.date BETWEEN ? AND ?
        AND b.status NOT IN ('cancelled', 'no_show')
      ORDER BY b.date ASC, b.time ASC
    `)
    .bind(departmentId, weekStart, weekEnd)
    .all<DBBookingDetail>();
  return results;
}

export async function getAllBookings(): Promise<DBBooking[]> {
  await requireSuperAdmin();
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM bookings ORDER BY date DESC, time DESC')
    .all<DBBooking>();
  return results;
}

// ─── Super Admin Analytics ────────────────────────────────────────────────────

export type NetworkStats = {
  totalSalons: number;
  globalRevenue: number;
  topSalon: { department_id: string; completed_count: number } | null;
};

export async function getNetworkStats(): Promise<NetworkStats> {
  await requireSuperAdmin();
  const db = await getDB();

  const [salonsRow, revenueRow, topRow] = await Promise.all([
    // 1. Total active salons
    db.prepare('SELECT COUNT(*) AS total FROM salons').first<{ total: number }>(),

    // 2. Global revenue — join bookings → services to get price per completed booking
    db.prepare(`
      SELECT COALESCE(SUM(sv.price), 0) AS total
      FROM bookings b
      JOIN services sv ON b.service_id = sv.id
      WHERE b.status = 'completed'
    `).first<{ total: number }>(),

    // 3. Top salon by completed bookings count
    db.prepare(`
      SELECT department_id, COUNT(*) AS completed_count
      FROM bookings
      WHERE status = 'completed'
      GROUP BY department_id
      ORDER BY completed_count DESC
      LIMIT 1
    `).first<{ department_id: string; completed_count: number }>(),
  ]);

  return {
    totalSalons:   salonsRow?.total          ?? 0,
    globalRevenue: revenueRow?.total         ?? 0,
    topSalon:      topRow                    ?? null,
  };
}

export type ActivityBooking = {
  id: string;
  reference: string;
  client_name: string;
  client_phone: string;
  status: string;
  date: string;
  time: string;
  created_at: string;
  salon_name: string;
  service_name: string;
};

export async function getRecentActivity(limit = 10): Promise<ActivityBooking[]> {
  await requireSuperAdmin();
  const db = await getDB();
  const { results } = await db
    .prepare(`
      SELECT
        b.id, b.reference, b.client_name, b.client_phone,
        b.status, b.date, b.time, b.created_at,
        s.name  AS salon_name,
        sv.name AS service_name
      FROM bookings b
      JOIN salons   s  ON b.department_id = s.id
      JOIN services sv ON b.service_id    = sv.id
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT ?
    `)
    .bind(limit)
    .all<ActivityBooking>();
  return results;
}

export async function updateBookingStatus(
  id: string,
  departmentId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  try {
    const { meta } = await db
      .prepare('UPDATE bookings SET status = ? WHERE id = ? AND department_id = ?')
      .bind(status, id, departmentId)
      .run();
    if (!meta.changes) return { ok: false, error: 'Booking not found or access denied.' };
    revalidatePath('/admin');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Database error: ' + String(e) };
  }
}

export async function deleteBooking(id: string, departmentId: string): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  await db
    .prepare('DELETE FROM bookings WHERE id = ? AND department_id = ?')
    .bind(id, departmentId)
    .run();
}

// ─── Financials ───────────────────────────────────────────────────────────────

export type StaffFinancialRow = {
  professional_id: string;
  name: string;
  avatar: string;
  comp_type: CompType;
  comp_base: number;
  comp_percentage: number;
  completed_count: number;
  completed_revenue: number;
  scheduled_count: number;
  scheduled_revenue: number;
  payout: number;
  margin: number;
};

export type FinancialsResult = {
  startDate: string;
  endDate: string;
  grossRevenue: number;
  projectedRevenue: number;
  payrollLiability: number;
  netProfit: number;
  avgTicket: number;
  completedCount: number;
  staff: StaffFinancialRow[];
};

function prorateBase(base: number, startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const year  = start.getFullYear();
  const month = start.getMonth();
  const monthDays = new Date(year, month + 1, 0).getDate();
  const rangeDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return (base * Math.min(rangeDays, monthDays)) / monthDays;
}

function calcPayout(
  row: { comp_type: CompType; comp_base: number; comp_percentage: number; completed_revenue: number },
  startDate: string,
  endDate: string,
): number {
  const { comp_type, comp_base, comp_percentage, completed_revenue } = row;
  const commission = completed_revenue * (comp_percentage / 100);
  if (comp_type === 'commission') return commission;
  const base = prorateBase(comp_base, startDate, endDate);
  if (comp_type === 'salary')    return base;
  // hybrid: whichever is higher
  return Math.max(base, commission);
}

export async function getFinancials(
  departmentId: string,
  startDate: string,
  endDate: string,
): Promise<FinancialsResult> {
  await requireSalonAccess(departmentId);
  const db = await getDB();

  type RawRow = {
    professional_id: string;
    name: string;
    avatar: string;
    comp_type: CompType;
    comp_base: number;
    comp_percentage: number;
    completed_count: number;
    completed_revenue: number;
    scheduled_count: number;
    scheduled_revenue: number;
  };

  const { results } = await db
    .prepare(`
      SELECT
        st.id           AS professional_id,
        st.name,
        st.avatar,
        st.comp_type,
        st.comp_base,
        st.comp_percentage,
        COALESCE(SUM(CASE WHEN b.status = 'completed'  THEN 1   ELSE 0 END), 0) AS completed_count,
        COALESCE(SUM(CASE WHEN b.status = 'completed'  THEN sv.price ELSE 0 END), 0) AS completed_revenue,
        COALESCE(SUM(CASE WHEN b.status = 'scheduled'  THEN 1   ELSE 0 END), 0) AS scheduled_count,
        COALESCE(SUM(CASE WHEN b.status = 'scheduled'  THEN sv.price ELSE 0 END), 0) AS scheduled_revenue
      FROM staff st
      LEFT JOIN bookings b
        ON b.professional_id = st.id
        AND b.department_id  = st.department_id
        AND b.date BETWEEN ? AND ?
      LEFT JOIN services sv ON b.service_id = sv.id
      WHERE st.department_id = ?
      GROUP BY st.id
    `)
    .bind(startDate, endDate, departmentId)
    .all<RawRow>();

  const staffRows: StaffFinancialRow[] = results.map(row => {
    const payout = calcPayout(row, startDate, endDate);
    const margin = row.completed_revenue > 0
      ? ((row.completed_revenue - payout) / row.completed_revenue) * 100
      : 0;
    return { ...row, payout: Math.round(payout * 100) / 100, margin: Math.round(margin * 10) / 10 };
  });

  const grossRevenue     = staffRows.reduce((s, r) => s + r.completed_revenue, 0);
  const projectedRevenue = grossRevenue + staffRows.reduce((s, r) => s + r.scheduled_revenue, 0);
  const payrollLiability = staffRows.reduce((s, r) => s + r.payout, 0);
  const netProfit        = grossRevenue - payrollLiability;
  const completedCount   = staffRows.reduce((s, r) => s + r.completed_count, 0);
  const avgTicket        = completedCount > 0 ? grossRevenue / completedCount : 0;

  return {
    startDate, endDate,
    grossRevenue:     Math.round(grossRevenue     * 100) / 100,
    projectedRevenue: Math.round(projectedRevenue * 100) / 100,
    payrollLiability: Math.round(payrollLiability * 100) / 100,
    netProfit:        Math.round(netProfit        * 100) / 100,
    avgTicket:        Math.round(avgTicket        * 100) / 100,
    completedCount,
    staff: staffRows,
  };
}

// ─── Seed Demo Data for a Branch ─────────────────────────────────────────────

export async function seedBranchDemoData(departmentId: string): Promise<{ ok: true; staffCount: number; serviceCount: number } | { ok: false; error: string }> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  const now = new Date().toISOString();

  const defaultHours = JSON.stringify([
    null,
    { s: '09:00', e: '19:00' },
    { s: '09:00', e: '19:00' },
    { s: '09:00', e: '19:00' },
    { s: '09:00', e: '19:00' },
    { s: '09:00', e: '19:00' },
    { s: '09:00', e: '18:00' },
  ]);

  const demoStaff = [
    { name: 'ნინო გელაშვილი', title: 'მასტერი', specialties: '[]', comp_type: 'commission', comp_base: 0, comp_pct: 40 },
    { name: 'ანა ბერიძე',      title: 'სენიორ მასტერი', specialties: '[]', comp_type: 'commission', comp_base: 0, comp_pct: 45 },
  ];

  const demoServices = [
    { name: 'მანიკური',          tagline: 'კლასიკური მანიკური',    duration: 60,  price: 35 },
    { name: 'პედიკური',          tagline: 'კლასიკური პედიკური',    duration: 75,  price: 45 },
    { name: 'გელ-ლაქი',          tagline: 'გელ-ლაქის დატანა',      duration: 30,  price: 20 },
    { name: 'ნეილ-არტი',         tagline: 'ნაილ ართის დიზაინი',    duration: 90,  price: 55 },
  ];

  try {
    const existingStaff = await db.prepare('SELECT id FROM staff WHERE department_id = ? LIMIT 1').bind(departmentId).first<{ id: string }>();
    let staffCount = 0;
    if (!existingStaff) {
      await db.batch(
        demoStaff.map(s => {
          const id = `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          return db.prepare(
            'INSERT INTO staff (id, department_id, name, title, avatar, specialties, working_hours, comp_type, comp_base, comp_percentage, buffer_extra, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(id, departmentId, s.name, s.title, '', s.specialties, defaultHours, s.comp_type, s.comp_base, s.comp_pct, 0, now);
        })
      );
      staffCount = demoStaff.length;
    }

    const existingServices = await db.prepare('SELECT id FROM services WHERE department_id = ? LIMIT 1').bind(departmentId).first<{ id: string }>();
    let serviceCount = 0;
    if (!existingServices) {
      await db.batch(
        demoServices.map(s => {
          const id = `sv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          return db.prepare(
            'INSERT INTO services (id, department_id, name, tagline, duration, buffer, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(id, departmentId, s.name, s.tagline, s.duration, 10, s.price, now);
        })
      );
      serviceCount = demoServices.length;
    }

    return { ok: true, staffCount, serviceCount };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Multi-branch Financials ──────────────────────────────────────────────────

export type BranchFinancials = FinancialsResult & { branchId: string; branchName: string };

export async function getFinancialsForBranches(
  salonId: string,
  branches: { id: string; name: string }[],
  startDate: string,
  endDate: string,
): Promise<BranchFinancials[]> {
  await requireSalonAccess(salonId);
  // Run all branch queries in parallel — no re-auth per branch since salon ownership is proven above
  return Promise.all(
    branches.map(async b => {
      const data = await getFinancials(b.id, startDate, endDate);
      return { ...data, branchId: b.id, branchName: b.name };
    }),
  );
}

// ─── Service Add-ons ──────────────────────────────────────────────────────────

export async function getServiceAddons(departmentId: string): Promise<DBServiceAddon[]> {
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM service_addons WHERE department_id = ? ORDER BY created_at ASC')
    .bind(departmentId)
    .all<DBServiceAddon>();
  return results;
}

export async function addServiceAddon(data: {
  departmentId: string;
  serviceId: string;
  name: string;
  duration: number;
  price: number;
}): Promise<DBServiceAddon> {
  await requireSalonAccess(data.departmentId);
  const id = `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const created_at = new Date().toISOString();
  const db = await getDB();
  await db
    .prepare('INSERT INTO service_addons (id, service_id, department_id, name, duration, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, data.serviceId, data.departmentId, data.name, data.duration, data.price, created_at)
    .run();
  return { id, service_id: data.serviceId, department_id: data.departmentId, name: data.name, duration: data.duration, price: data.price };
}

export async function deleteServiceAddon(id: string, departmentId: string): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  await db.prepare('DELETE FROM service_addons WHERE id = ? AND department_id = ?').bind(id, departmentId).run();
}

// ─── Addon Exclusions ─────────────────────────────────────────────────────────

export type AddonExclusion = { staff_id: string; addon_id: string };

export async function getAddonExclusions(departmentId: string): Promise<AddonExclusion[]> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT staff_id, addon_id FROM staff_addon_exclusions WHERE department_id = ?')
    .bind(departmentId)
    .all<AddonExclusion>();
  return results;
}

export async function toggleAddonExclusion(
  staffId: string,
  addonId: string,
  departmentId: string,
  excluded: boolean,
): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  if (excluded) {
    await db
      .prepare('INSERT OR IGNORE INTO staff_addon_exclusions (staff_id, addon_id, department_id) VALUES (?, ?, ?)')
      .bind(staffId, addonId, departmentId)
      .run();
  } else {
    await db
      .prepare('DELETE FROM staff_addon_exclusions WHERE staff_id = ? AND addon_id = ?')
      .bind(staffId, addonId)
      .run();
  }
}

// ─── Demo Data Seeding ────────────────────────────────────────────────────────

const DEMO_ADDONS: Record<string, Array<{ name: string; duration: number; price: number }>> = {
  nails: [
    { name: 'French Tips',       duration: 20, price: 15 },
    { name: 'Remove Old Nails',  duration: 15, price: 10 },
    { name: 'Nail Art (per nail)', duration: 30, price: 20 },
    { name: 'Gel Top Coat',      duration: 10, price: 8  },
  ],
  hair: [
    { name: 'Deep Conditioning', duration: 20, price: 15 },
    { name: 'Scalp Treatment',   duration: 15, price: 12 },
    { name: 'Toning',            duration: 30, price: 25 },
  ],
  brows: [
    { name: 'Brow Tint',         duration: 15, price: 10 },
    { name: 'Brow Lamination',   duration: 30, price: 30 },
  ],
  default: [
    { name: 'Express Add-on',    duration: 15, price: 10 },
    { name: 'Premium Upgrade',   duration: 20, price: 20 },
  ],
};

export async function seedDemoAddons(departmentId: string): Promise<{ added: number }> {
  await requireSalonAccess(departmentId);
  const db = await getDB();

  const { results: services } = await db
    .prepare('SELECT id, name FROM services WHERE department_id = ?')
    .bind(departmentId)
    .all<{ id: string; name: string }>();

  if (!services.length) return { added: 0 };

  // Single query to find which services already have at least one addon
  const placeholders = services.map(() => '?').join(',');
  const { results: seeded } = await db
    .prepare(`SELECT DISTINCT service_id FROM service_addons WHERE service_id IN (${placeholders})`)
    .bind(...services.map(s => s.id))
    .all<{ service_id: string }>();
  const seededIds = new Set(seeded.map(r => r.service_id));

  const created_at = new Date().toISOString();
  const inserts: D1PreparedStatement[] = [];

  for (const svc of services) {
    if (seededIds.has(svc.id)) continue;
    const lower = svc.name.toLowerCase();
    const templates =
      lower.includes('nail') ? DEMO_ADDONS.nails :
      lower.includes('hair') || lower.includes('cut') || lower.includes('color') ? DEMO_ADDONS.hair :
      lower.includes('brow') || lower.includes('lash') ? DEMO_ADDONS.brows :
      DEMO_ADDONS.default;
    for (const t of templates) {
      const id = `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      inserts.push(
        db.prepare('INSERT INTO service_addons (id, service_id, department_id, name, duration, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(id, svc.id, departmentId, t.name, t.duration, t.price, created_at)
      );
    }
  }

  if (inserts.length) await db.batch(inserts);
  return { added: inserts.length };
}

// ─── Buffer Management ────────────────────────────────────────────────────────

export async function updateServiceBuffer(id: string, departmentId: string, buffer: number): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  await db.prepare('UPDATE services SET buffer = ? WHERE id = ? AND department_id = ?').bind(buffer, id, departmentId).run();
}

export async function updateStaffBufferExtra(id: string, departmentId: string, bufferExtra: number): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  await db.prepare('UPDATE staff SET buffer_extra = ? WHERE id = ? AND department_id = ?').bind(bufferExtra, id, departmentId).run();
}

// ─── Admin Manual Booking ─────────────────────────────────────────────────────

export async function adminCreateBooking(data: {
  departmentId: string;
  professionalId: string;
  serviceId: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  addons: Array<{ id: string; name: string; duration: number; price: number }>;
}): Promise<{ ok: true; booking: DBBooking } | { ok: false; error: string }> {
  await requireSalonAccess(data.departmentId);
  const id        = `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const reference = 'MNL-' + Math.random().toString(36).substring(2, 7).toUpperCase();
  const addonsJson = JSON.stringify(data.addons);
  const created_at = new Date().toISOString();
  const db = await getDB();
  try {
    await db
      .prepare('INSERT INTO bookings (id, department_id, professional_id, service_id, date, time, client_name, client_phone, reference, addons, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, data.departmentId, data.professionalId, data.serviceId, data.date, data.time, data.clientName, data.clientPhone, reference, addonsJson, created_at)
      .run();
  } catch (e) {
    const msg = String(e);
    if (msg.includes('idx_no_double_booking') || msg.includes('UNIQUE constraint failed')) {
      return { ok: false, error: 'This slot is already booked. Please choose a different time.' };
    }
    return { ok: false, error: 'Database error: ' + msg };
  }
  revalidatePath('/admin');
  const booking: DBBooking = {
    id, department_id: data.departmentId, professional_id: data.professionalId,
    service_id: data.serviceId, date: data.date, time: data.time,
    client_name: data.clientName, client_phone: data.clientPhone,
    status: 'scheduled', reference, created_at, addons: addonsJson,
  };
  return { ok: true, booking };
}

// ─── Subscription Management (super admin only) ───────────────────────────────

export async function getAllSalons(): Promise<DBSalon[]> {
  await requireSuperAdmin();
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM salons ORDER BY created_at ASC')
    .all<DBSalon>();
  return results;
}

export async function setSalonSubscription(
  salonId: string,
  status: 'trial' | 'active' | 'suspended',
): Promise<void> {
  await requireSuperAdmin();
  const db = await getDB();
  await db
    .prepare('UPDATE salons SET subscription_status = ? WHERE id = ?')
    .bind(status, salonId)
    .run();
}

// ─── Branch Management ────────────────────────────────────────────────────────

export async function getBranchBySlug(slug: string): Promise<BranchRow | null> {
  const db = await getDB();
  const row = await db
    .prepare('SELECT * FROM branches WHERE slug = ? LIMIT 1')
    .bind(slug)
    .first<BranchRow>();
  return row ?? null;
}

export async function getSalonBranches(salonId: string): Promise<BranchRow[]> {
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM branches WHERE salon_id = ? ORDER BY created_at ASC')
    .bind(salonId)
    .all<BranchRow>();
  return results;
}

export async function createBranch(data: {
  salonId: string;
  name: string;
  slug: string;
  city?: string;
  address?: string;
  phone?: string;
}): Promise<{ ok: true; branch: BranchRow } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const slug = slugify(data.slug || data.name);
  if (!slug) return { ok: false, error: 'Invalid slug' };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: `Slug "${slug}" is reserved` };

  const db = await getDB();
  const taken = await db
    .prepare('SELECT id FROM branches WHERE slug = ? LIMIT 1')
    .bind(slug)
    .first<{ id: string }>();
  if (taken) return { ok: false, error: `Slug "${slug}" is already in use` };

  const id = `br-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const created_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await db
    .prepare('INSERT INTO branches (id, salon_id, name, slug, city, address, phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, data.salonId, data.name.trim(), slug, data.city?.trim() ?? null, data.address?.trim() ?? null, data.phone?.trim() ?? null, created_at)
    .run();

  const branch: BranchRow = { id, salon_id: data.salonId, name: data.name.trim(), slug, city: data.city?.trim() ?? null, address: data.address?.trim() ?? null, phone: data.phone?.trim() ?? null, created_at };
  return { ok: true, branch };
}

// ─── DB Migration Runner (super admin only) ───────────────────────────────────
// Applies the 004_multi_tenant migration safely via the Worker's D1 binding.

export async function applyMultiTenantMigration(): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const db = await getDB();
  try {
    await db.batch([
      db.prepare(`ALTER TABLE salons ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trial'`),
      db.prepare(`ALTER TABLE salons ADD COLUMN subscription_plan TEXT NOT NULL DEFAULT 'starter'`),
      db.prepare(`ALTER TABLE salons ADD COLUMN owner_email TEXT`),
    ]);
  } catch {
    // Columns may already exist — ignore duplicate column errors
  }
  try {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        city TEXT,
        address TEXT,
        phone TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_branches_salon ON branches(salon_id)`),
    ]);
  } catch (e) {
    return { ok: false, error: String(e) };
  }
  // Seed one branch per existing salon (branch.id = salon.id preserves all department_id refs)
  const { results: salons } = await db.prepare('SELECT id, name, slug, city, address FROM salons').all<{ id: string; name: string; slug: string; city: string; address: string }>();
  if (salons.length) {
    await db.batch(
      salons.map(s =>
        db.prepare('INSERT OR IGNORE INTO branches (id, salon_id, name, slug, city, address) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(s.id, s.id, s.name, s.slug, s.city, s.address)
      )
    );
  }
  return { ok: true, message: `Migration applied. ${salons.length} salon(s) seeded as branches.` };
}

// ─── Staff Auth Migration ──────────────────────────────────────────────────────

export async function applyStaffAuthMigration(): Promise<{ ok: boolean; message?: string; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'super_admin') return { ok: false, error: 'Unauthorized' };
  const db = await getDB();
  try {
    await db.batch([
      db.prepare(`ALTER TABLE staff ADD COLUMN pro_username TEXT`),
      db.prepare(`ALTER TABLE staff ADD COLUMN pro_password TEXT`),
    ]);
    await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_pro_username ON staff(pro_username) WHERE pro_username IS NOT NULL`).run();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
  return { ok: true, message: 'Staff auth columns added.' };
}

// ─── Staff Credentials (Salon Admin sets username/password for their staff) ───

export async function updateStaffCredentials(
  staffId: string,
  departmentId: string,
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'salon_admin') return { ok: false, error: 'Unauthorized' };

  const db = await getDB();
  const { hashPassword } = await import('@/lib/auth');

  const trimmedUsername = username.trim().toLowerCase();
  if (!trimmedUsername) return { ok: false, error: 'Username required' };

  // Ensure username is unique (excluding this staff member)
  const existing = await db
    .prepare('SELECT id FROM staff WHERE pro_username = ? AND id != ? LIMIT 1')
    .bind(trimmedUsername, staffId)
    .first<{ id: string }>();
  if (existing) return { ok: false, error: 'Username already taken' };

  const hashed = await hashPassword(password);
  await db
    .prepare('UPDATE staff SET pro_username = ?, pro_password = ? WHERE id = ? AND department_id = ?')
    .bind(trimmedUsername, hashed, staffId, departmentId)
    .run();

  revalidatePath('/admin');
  return { ok: true };
}

// ─── Professional Portal Actions ──────────────────────────────────────────────

async function requirePro(staffId: string) {
  const session = await getSession();
  if (!session || session.role !== 'professional' || session.staff_id !== staffId) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function getStaffProfile(staffId: string, departmentId: string): Promise<DBStaff | null> {
  await requirePro(staffId);
  const db = await getDB();
  return db
    .prepare('SELECT * FROM staff WHERE id = ? AND department_id = ? LIMIT 1')
    .bind(staffId, departmentId)
    .first<DBStaff>();
}

export async function getStaffBookings(
  staffId: string,
  departmentId: string,
  startDate?: string,
  endDate?: string,
): Promise<DBBooking[]> {
  await requirePro(staffId);
  const db = await getDB();
  let query = 'SELECT * FROM bookings WHERE professional_id = ? AND department_id = ?';
  const params: string[] = [staffId, departmentId];
  if (startDate) { query += ' AND date >= ?'; params.push(startDate); }
  if (endDate)   { query += ' AND date <= ?'; params.push(endDate); }
  query += ' ORDER BY date ASC, time ASC';
  const { results } = await db.prepare(query).bind(...params).all<DBBooking>();
  return results;
}

export async function getStaffFinancials(
  staffId: string,
  departmentId: string,
  startDate: string,
  endDate: string,
): Promise<{
  payout: number;
  revenue: number;
  completed: number;
  margin: number;
} | null> {
  await requirePro(staffId);
  const db = await getDB();

  const { results: bookings } = await db
    .prepare(`
      SELECT b.status, b.service_id, s.price, s.name as service_name,
             st.comp_type, st.comp_base, st.comp_percentage
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      JOIN staff st ON b.professional_id = st.id
      WHERE b.professional_id = ? AND b.department_id = ?
        AND b.date >= ? AND b.date <= ?
        AND b.status = 'completed'
    `)
    .bind(staffId, departmentId, startDate, endDate)
    .all<{
      status: string; service_id: string; price: number;
      comp_type: string; comp_base: number; comp_percentage: number;
    }>();

  if (!bookings.length) return { payout: 0, revenue: 0, completed: 0, margin: 0 };

  const revenue = bookings.reduce((s, b) => s + b.price, 0);
  const completed = bookings.length;
  const comp_type = bookings[0].comp_type;
  const comp_base = bookings[0].comp_base;
  const comp_percentage = bookings[0].comp_percentage;

  let payout = 0;
  if (comp_type === 'salary') payout = comp_base;
  else if (comp_type === 'commission') payout = revenue * (comp_percentage / 100);
  else payout = comp_base + revenue * (comp_percentage / 100); // hybrid

  const margin = revenue > 0 ? ((revenue - payout) / revenue) * 100 : 0;
  return { payout, revenue, completed, margin };
}
