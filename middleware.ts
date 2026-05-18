import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/admin/login') return NextResponse.next();

  const session = await validateRequest(req.headers.get('cookie'));
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/admin/login';

  if (pathname.startsWith('/pro')) {
    if (!session || session.role !== 'professional') return NextResponse.redirect(loginUrl);

    const reqHeaders = new Headers(req.headers);
    reqHeaders.set('x-session-role', 'professional');
    reqHeaders.set('x-session-staff-id', session.staff_id);
    reqHeaders.set('x-session-dept-id', session.department_id);
    return NextResponse.next({ request: { headers: reqHeaders } });
  }

  // /admin/* routes
  if (!session) return NextResponse.redirect(loginUrl);

  // Professionals should not access admin panel
  if (session.role === 'professional') return NextResponse.redirect(loginUrl);

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-session-role', session.role);
  if (session.role === 'salon_admin') {
    reqHeaders.set('x-session-salon-id', session.salon_id);
  }

  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/pro', '/pro/:path*'],
};
