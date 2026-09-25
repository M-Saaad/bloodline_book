const INVISIBLE = /[\u200B-\u200D\uFEFF]/g;

/**
 * Turn a typed or pasted address into the mailbox Supabase should receive.
 * Accepts short local parts, plus-tags, apostrophes, and long TLDs.
 * Strips spaces and invisible characters that make a real address fail
 * the server format check.
 */
export function normalizeAuthEmail(raw: string): string {
  const stripped = raw.replace(INVISIBLE, '').trim();
  const angle = stripped.match(/<([^<>\s]+@[^<>\s]+)>/);
  const candidate = (angle?.[1] ?? stripped).replace(/\s+/g, '');
  return candidate.toLowerCase();
}

/** Loose shape check. It allows the addresses the old format check rejected. */
export function isAcceptableAuthEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function recoveryParamsFromUrl(url: string): {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
} {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const query =
    queryIndex >= 0
      ? url.slice(
          queryIndex + 1,
          hashIndex > queryIndex ? hashIndex : undefined,
        )
      : '';
  const queryParams = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);
  const get = (key: string) => hashParams.get(key) ?? queryParams.get(key);
  return {
    accessToken: get('access_token'),
    refreshToken: get('refresh_token'),
    code: get('code'),
  };
}
