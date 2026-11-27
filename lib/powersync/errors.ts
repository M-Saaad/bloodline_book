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

/**
 * Postgres check_violation (23514), including the same-farm dam/sire trigger.
 * Retrying the same row will never succeed.
 */
export function isCheckViolationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const record = error as { code?: unknown; message?: unknown };
  if (record.code === '23514') {
    return true;
  }
  return typeof record.message === 'string' && /\b23514\b/.test(record.message);
}

export function isFatalUploadError(error: unknown): boolean {
  if (isDuplicateKeyError(error) || isCheckViolationError(error)) {
    return true;
  }
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      return FATAL_UPLOAD_ERROR_CODES.some((pattern) => pattern.test(code));
    }
  }
  return false;
}

export function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const record = error as { code?: unknown; message?: unknown };
  if (record.code === '23505') {
    return true;
  }
  return (
    typeof record.message === 'string' &&
    /duplicate key value violates unique constraint/i.test(record.message)
  );
}

export function getUploadErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return null;
}

/** Thrown when PostgREST returns zero rows for PATCH/DELETE (often RLS). */
export function uploadRowRejectedError(
  operation: 'update' | 'delete',
): Record<string, string> {
  return {
    code: '42501',
    message:
      operation === 'update'
        ? 'Update was rejected by the server.'
        : 'Delete was rejected by the server.',
  };
}
