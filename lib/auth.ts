import { getCloudflareContext } from '@opennextjs/cloudflare';

export type SessionPayload =
  | { role: 'super_admin' }
  | { role: 'salon_admin'; salon_id: string }
  | { role: 'professional'; staff_id: string; department_id: string };

const COOKIE = 'admin_session';

async function getSecret(name: 'MASTER_PASSWORD'): Promise<string | undefined> {
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

// ─── PBKDF2 helpers (reused by staff credential verification) ─────────────────

async function pbkdf2Hash(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, 256,
  );
}

function timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function verifyPbkdf2(password: string, stored: string): Promise<boolean> {
  try {
    const [saltHex, hashHex] = stored.split(':');
    const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const hash = Uint8Array.from(hashHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const derived = await pbkdf2Hash(password, salt);
    return timingSafeEqual(derived, hash.buffer);
  } catch {
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Hash(password, salt);
  const toHex = (buf: Uint8Array) => Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${toHex(salt)}:${toHex(new Uint8Array(hash))}`;
}

// ─── Staff credential lookup ──────────────────────────────────────────────────

export async function findStaffByLogin(
  username: string,
  password: string,
  db: D1Database,
): Promise<{ id: string; department_id: string } | null> {
  const row = await db
    .prepare('SELECT id, department_id, pro_password FROM staff WHERE pro_username = ? LIMIT 1')
    .bind(username.toLowerCase())
    .first<{ id: string; department_id: string; pro_password: string }>();
  if (!row?.pro_password) return null;
  const ok = await verifyPbkdf2(password, row.pro_password);
  return ok ? { id: row.id, department_id: row.department_id } : null;
}

export { getSecret };
export const COOKIE_NAME = COOKIE;
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
