/** Supabase project URL must be https://<ref>.supabase.co — not the REST path. */
export function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');
}

export function isValidSupabaseProjectUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(normalizeSupabaseUrl(url));
}
