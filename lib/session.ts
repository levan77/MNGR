import { headers } from 'next/headers';
import type { SessionPayload } from './auth';

export async function getSession(): Promise<SessionPayload | null> {
  const h = await headers();
  const role = h.get('x-session-role');
  if (!role) return null;
  if (role === 'super_admin') return { role: 'super_admin' };
  if (role === 'salon_admin') {
    const salon_id = h.get('x-session-salon-id');
    if (salon_id) return { role: 'salon_admin', salon_id };
  }
  if (role === 'professional') {
    const staff_id = h.get('x-session-staff-id');
    const department_id = h.get('x-session-dept-id');
    if (staff_id && department_id) return { role: 'professional', staff_id, department_id };
  }
  return null;
}
