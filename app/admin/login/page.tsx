import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  const cookieStore = await cookies();
  const isValid = await validateSession(cookieStore.toString());
  if (isValid) redirect('/admin');
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
