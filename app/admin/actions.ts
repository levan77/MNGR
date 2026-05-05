'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { validateRequest } from '@/lib/auth';
import { cookies } from 'next/headers';

export type DBSalon = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  admin_username: string;
  admin_password: string;
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

export type DBStaff = {
  id: string;
  department_id: string;
  name: string;
  title: string;
  avatar: string;
  specialties: string;
  working_hours: string;
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
};

async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext<CloudflareEnv>();
  if (!env.DB) throw new Error('D1 binding "DB" is not configured on this Worker');
  return env.DB;
}

async function requireSalonAccess(departmentId: string): Promise<void> {
  const cookieHeader = (await cookies()).toString();
  const session = await validateRequest(cookieHeader);
  if (!session) throw new Error('Unauthorized');
  if (session.role === 'super_admin') return;
  if (session.role === 'salon_admin' && session.salon_id === departmentId) return;
  throw new Error('Forbidden');
}

async function requireSuperAdmin(): Promise<void> {
  const cookieHeader = (await cookies()).toString();
  const session = await validateRequest(cookieHeader);
  if (!session || session.role !== 'super_admin') throw new Error('Forbidden — super admin only');
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
  if (['admin', 'api', 'booking', '_next', 'favicon.ico'].includes(slug)) {
    return { ok: false, error: `Slug "${slug}" is reserved` };
  }

  const db = await getDB();
  const slugTaken = await db.prepare('SELECT id FROM salons WHERE slug = ? LIMIT 1').bind(slug).first<{ id: string }>();
  if (slugTaken) return { ok: false, error: `Slug "${slug}" is already in use` };
  const userTaken = await db.prepare('SELECT id FROM salons WHERE admin_username = ? LIMIT 1').bind(username).first<{ id: string }>();
  if (userTaken) return { ok: false, error: `Username "${username}" is already in use` };

  const id = `sal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await db
    .prepare('INSERT INTO salons (id, slug, name, city, address, admin_username, admin_password) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, slug, name, data.city?.trim() ?? '', data.address?.trim() ?? '', username, password)
    .run();

  const salon = await getSalonById(id);
  if (!salon) return { ok: false, error: 'Created but failed to fetch' };
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

  const next = {
    name: data.name?.trim() ?? existing.name,
    slug: data.slug !== undefined ? slugify(data.slug) : existing.slug,
    city: data.city?.trim() ?? existing.city,
    address: data.address?.trim() ?? existing.address,
    admin_username: data.adminUsername?.trim().toLowerCase() ?? existing.admin_username,
    admin_password: data.adminPassword && data.adminPassword.length > 0 ? data.adminPassword : existing.admin_password,
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

  const salon = await getSalonById(id);
  return salon ? { ok: true, salon } : { ok: false, error: 'Updated but fetch failed' };
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
  const row = await db
    .prepare('SELECT * FROM salons WHERE admin_username = ? AND admin_password = ? LIMIT 1')
    .bind(username, password)
    .first<DBSalon>();
  return row ?? null;
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
}): Promise<DBStaff> {
  await requireSalonAccess(data.departmentId);
  const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const db = await getDB();
  await db
    .prepare('INSERT INTO staff (id, department_id, name, title, avatar, specialties, working_hours) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, data.departmentId, data.name, data.title, data.avatar, '[]', DEFAULT_HOURS)
    .run();
  return {
    id, department_id: data.departmentId, name: data.name, title: data.title,
    avatar: data.avatar, specialties: '[]', working_hours: DEFAULT_HOURS,
  };
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
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM bookings WHERE department_id = ? ORDER BY date DESC, time DESC')
    .bind(departmentId)
    .all<DBBooking>();
  return results;
}

export async function getAllBookings(): Promise<DBBooking[]> {
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM bookings ORDER BY date DESC, time DESC')
    .all<DBBooking>();
  return results;
}

export async function updateBookingStatus(id: string, departmentId: string, status: string): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  await db
    .prepare('UPDATE bookings SET status = ? WHERE id = ? AND department_id = ?')
    .bind(status, id, departmentId)
    .run();
}

export async function deleteBooking(id: string, departmentId: string): Promise<void> {
  await requireSalonAccess(departmentId);
  const db = await getDB();
  await db
    .prepare('DELETE FROM bookings WHERE id = ? AND department_id = ?')
    .bind(id, departmentId)
    .run();
}
