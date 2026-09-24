import type { AbstractPowerSyncDatabase, CrudEntry } from '@powersync/common';
import * as Crypto from 'expo-crypto';

import { formatUploadError, getUploadErrorCode } from '@/lib/powersync/errors';

export async function recordUploadTransactionFailures(
  database: AbstractPowerSyncDatabase,
  ops: readonly CrudEntry[],
  failedOpIndex: number,
  error: unknown,
): Promise<void> {
  if (ops.length === 0) {
    return;
  }

  const errorCode = getUploadErrorCode(error);
  const errorMessage = formatUploadError(error);
  const createdAt = new Date().toISOString();

  await database.writeTransaction(async (tx) => {
    for (let index = 0; index < ops.length; index += 1) {
      const op = ops[index];
      const id = Crypto.randomUUID();
      await tx.execute(
        `INSERT INTO upload_failures (
          id, table_name, op, row_id, op_data, error_code, error_message,
          applied_before_failure, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          op.table,
          String(op.op),
          op.id,
          JSON.stringify(op.opData ?? {}),
          errorCode,
          errorMessage,
          index < failedOpIndex ? 1 : 0,
          createdAt,
        ],
      );
    }
  });
}

export async function dismissUploadFailure(id: string): Promise<void> {
  const { powersync } = await import('@/lib/powersync/system');
  await powersync.execute('DELETE FROM upload_failures WHERE id = ?', [id]);
}

export async function countUploadFailures(): Promise<number> {
  const { powersync } = await import('@/lib/powersync/system');
  const row = await powersync.getOptional<{ c: number }>(
    'SELECT COUNT(*) AS c FROM upload_failures',
  );
  return row?.c ?? 0;
}
