import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/admin/login') return NextResponse.next();

  const session = await validateRequest(req.headers.get('cookie'));

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }

  // Forward session into request headers so server components can read it
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-session-role', session.role);
  if (session.role === 'salon_admin') {
    reqHeaders.set('x-session-salon-id', session.salon_id);
  }

  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
