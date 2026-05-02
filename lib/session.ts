import { headers } from 'next/headers';
import type { SessionPayload } from './auth';

export async function getSession(): Promise<SessionPayload | null> {
  const h = await headers();
  const role = h.get('x-session-role');
  if (!role) return null;
  if (role === 'super_admin') return { role: 'super_admin' };
  const salon_id = h.get('x-session-salon-id');
  if (role === 'salon_admin' && salon_id) return { role: 'salon_admin', salon_id };
  return null;
}
