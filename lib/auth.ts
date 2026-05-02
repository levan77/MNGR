const COOKIE_NAME = 'admin_session';
const SESSION_DATA = 'admin-session-v1';

async function deriveToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(SESSION_DATA));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function createSessionCookie(password: string): Promise<string> {
  const token = await deriveToken(password);
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
}

export async function validateSession(cookieHeader: string | null): Promise<boolean> {
  if (!cookieHeader) return false;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;

  const expected = await deriveToken(adminPassword);
  return match[1] === expected;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
