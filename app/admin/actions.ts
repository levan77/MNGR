'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';

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
  const { env } = await getCloudflareContext<CloudflareEnv>();
  return env.DB;
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
