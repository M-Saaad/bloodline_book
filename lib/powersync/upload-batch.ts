import { formatUploadError } from '@/lib/powersync/errors';

/** An operation failed. `original` is the PostgREST error, which still has `code`. */
export class UploadOpError extends Error {
  readonly opIndex: number;
  readonly original: unknown;

  constructor(opIndex: number, original: unknown) {
    super(formatUploadError(original));
    this.name = 'UploadOpError';
    this.opIndex = opIndex;
    this.original = original;
  }
}

/**
 * Applies each upload operation. A permanent skip (Postgres 23514) is recorded
 * and the rest of the batch still runs. Any other error stops the batch so the
 * caller can retry or discard the transaction.
 */
export async function applyUploadBatch<T>(input: {
  ops: readonly T[];
  apply: (op: T) => Promise<void>;
  isPermanentSkip: (error: unknown) => boolean;
  onPermanentSkip: (op: T, error: unknown) => Promise<void>;
}): Promise<void> {
  for (let index = 0; index < input.ops.length; index += 1) {
    const op = input.ops[index];
    try {
      await input.apply(op);
    } catch (error) {
      if (input.isPermanentSkip(error)) {
        await input.onPermanentSkip(op, error);
        continue;
      }
      throw new UploadOpError(index, error);
    }
  }
}
