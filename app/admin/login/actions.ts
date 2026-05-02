'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSessionCookie } from '@/lib/auth';

export async function loginAction(formData: FormData) {
  const password = formData.get('password') as string;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    redirect('/admin/login?error=1');
  }

  const cookieStr = await createSessionCookie(password);
  const value = cookieStr.split('=').slice(1).join('=').split(';')[0];
  (await cookies()).set('admin_session', value, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect('/admin');
}

export async function logoutAction() {
  (await cookies()).delete('admin_session');
  redirect('/admin/login');
}
