'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { DBService, DBStaff, DBBooking, DBServiceAddon, AddonExclusion } from '@/app/admin/actions';

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

export type { AddonExclusion as PublicAddonExclusion };

export async function publicGetAddonExclusions(salonId: string): Promise<AddonExclusion[]> {
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT staff_id, addon_id FROM staff_addon_exclusions WHERE department_id = ?')
    .bind(salonId)
    .all<AddonExclusion>();
  return results;
}

export async function publicGetAllAddons(salonId: string): Promise<DBServiceAddon[]> {
  const db = await getDB();
  const { results } = await db
    .prepare('SELECT * FROM service_addons WHERE department_id = ? ORDER BY created_at ASC')
    .bind(salonId)
    .all<DBServiceAddon>();
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
  addons?: Array<{ id: string; name: string; duration: number; price: number }>;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!data.clientName.trim() || !data.clientPhone.trim()) {
    return { ok: false, error: 'Missing client info' };
  }
  if (!data.departmentId || !data.professionalId || !data.serviceId || !data.date || !data.time) {
    return { ok: false, error: 'Missing booking details' };
  }

  const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const addonsJson = JSON.stringify(data.addons ?? []);
  const db = await getDB();

  try {
    await db
      .prepare('INSERT INTO bookings (id, department_id, professional_id, service_id, date, time, client_name, client_phone, reference, addons) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, data.departmentId, data.professionalId, data.serviceId, data.date, data.time, data.clientName, data.clientPhone, data.reference, addonsJson)
      .run();
  } catch (e) {
    const msg = String(e);
    if (msg.includes('idx_no_double_booking') || msg.includes('UNIQUE constraint failed')) {
      return { ok: false, error: 'This slot was just claimed by another user. Please select a new time.' };
    }
    return { ok: false, error: 'Database error: ' + msg };
  }

  return { ok: true, id };
}
