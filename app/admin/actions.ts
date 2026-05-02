'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { validateRequest } from '@/lib/auth';
import { cookies } from 'next/headers';

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
