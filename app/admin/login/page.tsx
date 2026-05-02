import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { validateRequest } from '@/lib/auth';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = await validateRequest(cookieStore.toString());
  if (session) redirect('/admin');
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
