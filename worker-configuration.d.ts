// Auto-generated bindings for the Cloudflare Worker environment.
// Keep in sync with wrangler.toml [[d1_databases]] and [vars] sections.
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  MASTER_PASSWORD: string;
  SALON_CREDENTIALS: string;
  [key: string]: unknown;
}
