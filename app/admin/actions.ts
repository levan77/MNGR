'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';

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
  specialties: string;   // JSON string — parse on use
  working_hours: string; // JSON string — parse on use
};

async function getDB(): Promise<D1Database> {
  const ctx = await getCloudflareContext<CloudflareEnv>();
  if (!ctx?.env?.DB) {
    throw new Error(`D1 binding unavailable. env keys: ${Object.keys(ctx?.env ?? {}).join(', ')}`);
  }
  return ctx.env.DB;
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
  const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const db = await getDB();
  await db
    .prepare('INSERT INTO services (id, department_id, name, tagline, duration, buffer, price) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, data.departmentId, data.name, data.tagline, data.duration, 10, data.price)
    .run();
  return { id, department_id: data.departmentId, name: data.name, tagline: data.tagline, duration: data.duration, buffer: 10, price: data.price };
}

export async function deleteService(id: string, departmentId: string): Promise<void> {
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
  const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const db = await getDB();
  await db
    .prepare('INSERT INTO staff (id, department_id, name, title, avatar, specialties, working_hours) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, data.departmentId, data.name, data.title, data.avatar, '[]', DEFAULT_HOURS)
    .run();
  return { id, department_id: data.departmentId, name: data.name, title: data.title, avatar: data.avatar, specialties: '[]', working_hours: DEFAULT_HOURS };
}

export async function deleteStaffMember(id: string, departmentId: string): Promise<void> {
  const db = await getDB();
  await db
    .prepare('DELETE FROM staff WHERE id = ? AND department_id = ?')
    .bind(id, departmentId)
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

export async function createBooking(data: {
  departmentId: string;
  professionalId: string;
  serviceId: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  reference: string;
}): Promise<DBBooking> {
  const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const db = await getDB();
  await db
    .prepare('INSERT INTO bookings (id, department_id, professional_id, service_id, date, time, client_name, client_phone, reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, data.departmentId, data.professionalId, data.serviceId, data.date, data.time, data.clientName, data.clientPhone, data.reference)
    .run();
  return {
    id, department_id: data.departmentId, professional_id: data.professionalId,
    service_id: data.serviceId, date: data.date, time: data.time,
    client_name: data.clientName, client_phone: data.clientPhone,
    status: 'scheduled', reference: data.reference,
    created_at: new Date().toISOString(),
  };
}

export async function updateBookingStatus(id: string, status: string): Promise<void> {
  const db = await getDB();
  await db
    .prepare('UPDATE bookings SET status = ? WHERE id = ?')
    .bind(status, id)
    .run();
}

export async function deleteBooking(id: string): Promise<void> {
  const db = await getDB();
  await db
    .prepare('DELETE FROM bookings WHERE id = ?')
    .bind(id)
    .run();
}
