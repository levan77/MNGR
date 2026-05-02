import { getCloudflareContext } from '@opennextjs/cloudflare';

export type SessionPayload =
  | { role: 'super_admin' }
  | { role: 'salon_admin'; salon_id: string };

const COOKIE = 'admin_session';

async function getSecret(name: 'MASTER_PASSWORD' | 'SALON_CREDENTIALS'): Promise<string | undefined> {
  try {
    const { env } = await getCloudflareContext<CloudflareEnv>();
    const v = env[name];
    if (typeof v === 'string') return v;
  } catch {}
  return process.env[name];
}

function toB64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromB64url(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

function bufToB64url(buf: ArrayBuffer): string {
  return toB64url(String.fromCharCode(...new Uint8Array(buf)));
}

async function signingKey(): Promise<CryptoKey> {
  const secret = (await getSecret('MASTER_PASSWORD')) ?? 'dev-fallback-change-me';
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const data = toB64url(JSON.stringify(payload));
  const key = await signingKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${bufToB64url(sig)}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const data = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const key = await signingKey();
    const rawSig = Uint8Array.from(fromB64url(sig), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, rawSig, new TextEncoder().encode(data));
    if (!ok) return null;
    return JSON.parse(fromB64url(data)) as SessionPayload;
  } catch {
    return null;
  }
}

export function extractToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

export async function validateRequest(cookieHeader: string | null): Promise<SessionPayload | null> {
  const token = extractToken(cookieHeader);
  return token ? verifySession(token) : null;
}

export { getSecret };
export const COOKIE_NAME = COOKIE;
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
