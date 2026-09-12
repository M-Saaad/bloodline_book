/** Supabase project URL must be https://<ref>.supabase.co — not the REST path. */
export function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');
}

export function isValidSupabaseProjectUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(normalizeSupabaseUrl(url));
}

/**
 * Cloud Agent / copied secrets sometimes store the JWT header twice:
 * `header.header.payload.signature` instead of `header.payload.signature`.
 * Supabase Auth then returns "Invalid API key".
 */
export function sanitizeSupabaseJwtKey(key: string): string {
  const trimmed = key.trim();
  const parts = trimmed.split('.');
  if (
    parts.length === 4 &&
    parts[0] === parts[1] &&
    parts[0].startsWith('eyJ')
  ) {
    return `${parts[0]}.${parts[2]}.${parts[3]}`;
  }
  return trimmed;
}
