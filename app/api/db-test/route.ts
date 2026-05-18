import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { env } = await getCloudflareContext<CloudflareEnv>();
    if (!env.DB) {
      return NextResponse.json({ ok: false, error: 'DB binding missing from env' });
    }
    const { results } = await env.DB
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all<{ name: string }>();
    const tables = results.map(r => r.name);

    const counts: Record<string, number> = {};
    for (const t of tables.filter(t => !t.startsWith('_'))) {
      const row = await env.DB.prepare(`SELECT COUNT(*) as c FROM ${t}`).first<{ c: number }>();
      counts[t] = row?.c ?? -1;
    }
    return NextResponse.json({ ok: true, tables, counts });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
