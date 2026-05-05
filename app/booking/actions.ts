'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { DBService, DBStaff, DBBooking } from '@/app/admin/actions';

async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext<CloudflareEnv>();
  if (!env.DB) throw new Error('D1 binding "DB" is not configured');
  return env.DB;
}

export async function publicGetServices(salonId: string): Promise<DBService[]> {
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM services WHERE department_id = ? ORDER BY created_at ASC')
    .bind(salonId)
    .all<DBService>();
  return results;
}

export async function publicGetStaff(salonId: string): Promise<DBStaff[]> {
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM staff WHERE department_id = ? ORDER BY created_at ASC')
    .bind(salonId)
    .all<DBStaff>();
  return results;
}

export async function publicGetBookings(salonId: string, professionalId: string): Promise<DBBooking[]> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT * FROM bookings WHERE department_id = ? AND professional_id = ? AND status NOT IN ('cancelled','no_show')")
    .bind(salonId, professionalId)
    .all<DBBooking>();
  return results;
}

export async function publicCreateBooking(data: {
  departmentId: string;
  professionalId: string;
  serviceId: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  reference: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!data.clientName.trim() || !data.clientPhone.trim()) {
    return { ok: false, error: 'Missing client info' };
  }
  if (!data.departmentId || !data.professionalId || !data.serviceId || !data.date || !data.time) {
    return { ok: false, error: 'Missing booking details' };
  }

  const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const db = await getDB();

  try {
    const conflict = await db
      .prepare("SELECT id FROM bookings WHERE department_id = ? AND professional_id = ? AND date = ? AND time = ? AND status NOT IN ('cancelled','no_show') LIMIT 1")
      .bind(data.departmentId, data.professionalId, data.date, data.time)
      .first<{ id: string }>();
    if (conflict) return { ok: false, error: 'Slot just got booked — please pick another' };

    await db
      .prepare('INSERT INTO bookings (id, department_id, professional_id, service_id, date, time, client_name, client_phone, reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, data.departmentId, data.professionalId, data.serviceId, data.date, data.time, data.clientName, data.clientPhone, data.reference)
      .run();
  } catch (e) {
    return { ok: false, error: 'Database error: ' + String(e) };
  }

  return { ok: true, id };
}
