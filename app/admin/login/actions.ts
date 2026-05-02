'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { signSession, getSecret, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth';
import type { SessionPayload } from '@/lib/auth';

type SalonCredential = { username: string; password: string; salon_id: string };

export async function loginAction(formData: FormData) {
  const username = (formData.get('username') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!username || !password) redirect('/admin/login?error=1');

  let payload: SessionPayload | null = null;

  if (username === 'master') {
    const masterPw = await getSecret('MASTER_PASSWORD');
    if (masterPw && password === masterPw) payload = { role: 'super_admin' };
  } else {
    try {
      const raw = (await getSecret('SALON_CREDENTIALS')) ?? '[]';
      const salons: SalonCredential[] = JSON.parse(raw);
      const match = salons.find(s => s.username === username && s.password === password);
      if (match) payload = { role: 'salon_admin', salon_id: match.salon_id };
    } catch {}
  }

  if (!payload) redirect('/admin/login?error=1');

  const token = await signSession(payload);
  (await cookies()).set(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });

  redirect('/admin');
}

export async function logoutAction() {
  (await cookies()).delete(COOKIE_NAME);
  redirect('/admin/login');
}
