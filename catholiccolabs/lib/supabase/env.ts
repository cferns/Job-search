/**
 * Centralised, validated access to the public Supabase environment variables.
 * Throws a clear, actionable error when the project hasn't been configured yet.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Copy `.env.local.example` to `.env.local` " +
        "and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

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
