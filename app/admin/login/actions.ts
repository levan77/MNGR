'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { signSession, getSecret, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth';
import type { SessionPayload } from '@/lib/auth';
import { findSalonByLogin } from '@/app/admin/actions';

export async function loginAction(formData: FormData) {
  const username = (formData.get('username') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!username || !password) redirect('/admin/login?error=1');

  let payload: SessionPayload | null = null;

  if (username === 'master') {
    const masterPw = await getSecret('MASTER_PASSWORD');
    if (masterPw && password === masterPw) payload = { role: 'super_admin' };
  } else {
    const salon = await findSalonByLogin(username, password);
    if (salon) payload = { role: 'salon_admin', salon_id: salon.id };
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
