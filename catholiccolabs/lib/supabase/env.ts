/**
 * Default Supabase connection for the Vineyard-dev project. Both values are
 * "publishable" — the URL and the publishable/anon key are sent from the
 * browser on every request, so they are safe to ship in client code. Access is
 * still protected by Row-Level Security on the database, not key secrecy.
 *
 * Override either via NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * (e.g. to point a deployment at a different project).
 */
const DEFAULT_SUPABASE_URL = "https://kfrarmtbcaeulywpjdvw.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_zAEiE13Hp0LogWFtZAD0wQ_xTTRzCbG";

/**
 * Centralised access to the public Supabase connection details. Reads the
 * environment first and falls back to the Vineyard-dev defaults above, so the
 * app works out of the box with no extra configuration.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

  return { url, anonKey };
}

/**
 * The canonical origin of the site, used to build absolute redirect URLs for
 * OAuth and password-reset flows. Falls back to localhost in development.
 */
export function getSiteUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  return (fromEnv || "http://localhost:3000").replace(/\/$/, "");
}
