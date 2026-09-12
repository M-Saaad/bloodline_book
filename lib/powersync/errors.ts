/** Tables written only by Supabase triggers / server sync — never client upload. */
export const SERVER_MANAGED_UPLOAD_TABLES = new Set(['farm_members']);

/** PostgREST / Postgres codes where retrying the same upload will never succeed. */
const FATAL_UPLOAD_ERROR_CODES = [
  /^22/, // data exception
  /^23/, // integrity constraint
  /^42501$/, // insufficient privilege (RLS)
  /^PGRST204$/, // unknown column (e.g. farm_members.id)
];

export function formatUploadError(error: unknown): string {
  if (error instanceof Error && error.message && error.message !== '[object Object]') {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const message =
      (typeof record.message === 'string' && record.message) ||
      (typeof record.msg === 'string' && record.msg) ||
      (typeof record.error === 'string' && record.error) ||
      null;
    const code = typeof record.code === 'string' ? record.code : null;
    const details =
      typeof record.details === 'string' && record.details ? record.details : null;
    const hint = typeof record.hint === 'string' && record.hint ? record.hint : null;

    const parts = [
      message,
      code ? `(code ${code})` : null,
      details,
      hint,
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(' — ');
    }
  }

  return String(error);
}

export function toUploadError(error: unknown): Error {
  return new Error(formatUploadError(error));
}

export function isFatalUploadError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      return FATAL_UPLOAD_ERROR_CODES.some((pattern) => pattern.test(code));
    }
  }
  return false;
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === '23505'
  );
}
