import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/common';

import { getPowerSyncUrl, isPowerSyncConfigured } from '@/lib/powersync/config';
import {
  formatUploadError,
  isCheckViolationError,
  isDuplicateKeyError,
  isFatalUploadError,
  SERVER_MANAGED_UPLOAD_TABLES,
  toUploadError,
  uploadRowRejectedError,
} from '@/lib/powersync/errors';
import { applyUploadBatch, UploadOpError } from '@/lib/powersync/upload-batch';
import { recordUploadTransactionFailures } from '@/lib/powersync/upload-failures';
import { supabase } from '@/lib/supabase/client';

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw toUploadError(error);
    }

    if (!session) {
      throw new Error('Not signed in');
    }

    const endpoint = getPowerSyncUrl();
    if (!isPowerSyncConfigured()) {
      throw new Error(
        'PowerSync endpoint not configured. Set EXPO_PUBLIC_POWERSYNC_URL in .env and restart the dev server.',
      );
    }

    return {
      endpoint,
      token: session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    const ops = transaction.crud;

    try {
      await applyUploadBatch({
        ops,
        apply: (op) => this.applyCrud(op),
        // 23514 (same-farm dam/sire, or any other check) will never succeed on
        // retry. Skip that row, keep uploading the rest of this batch, and let
        // the next queued transaction run.
        isPermanentSkip: isCheckViolationError,
        onPermanentSkip: async (op, error) => {
          await recordUploadTransactionFailures(database, [op], 0, error);
        },
      });
      await transaction.complete();
    } catch (error) {
      const cause = error instanceof UploadOpError ? error.original : error;
      const failedOpIndex = error instanceof UploadOpError ? error.opIndex : 0;
      const uploadError = toUploadError(cause);
      const failedOp = ops[failedOpIndex] ?? null;
      const fatal = isFatalUploadError(cause);
      const logDetail = {
        table: failedOp?.table,
        op: failedOp?.op,
        id: failedOp?.id,
      };
      const logMessage = `PowerSync upload ${fatal ? 'error' : 'retry'}: ${formatUploadError(cause)}`;
      if (fatal) {
        console.error(logMessage, logDetail);
      } else {
        // Retryable (e.g. offline). Avoid console.error — Expo web treats it as a blocking error toast.
        console.warn(logMessage, logDetail);
      }

      if (fatal) {
        console.error(
          'PowerSync upload error is not retryable — recording and completing transaction:',
          failedOp,
        );
        try {
          await recordUploadTransactionFailures(
            database,
            ops,
            failedOpIndex,
            cause,
          );
        } catch (recordError) {
          console.error('Failed to record upload failures:', recordError);
        }
        await transaction.complete();
        return;
      }

      throw uploadError;
    }
  }

  private buildRecord(op: CrudEntry): Record<string, unknown> {
    return { ...op.opData, id: op.id };
  }

  private async applyCrud(op: CrudEntry): Promise<void> {
    if (SERVER_MANAGED_UPLOAD_TABLES.has(op.table)) {
      // farm_members is membership written by Postgres triggers. It has no id
      // column, so a client upload of the sync id would be rejected.
      return;
    }

    const table = op.table;
    const record = this.buildRecord(op);

    switch (op.op) {
      case UpdateType.PUT: {
        // Use INSERT, not UPSERT: PostgREST upsert also evaluates UPDATE RLS, which
        // blocks new farm rows before on_farm_created adds farm_members membership.
        const { error } = await supabase.from(table).insert(record);
        // Two phones can each insert a current tag_history row for the same goat
        // and kind. Skip 23505 so that upload is not retried and the rest of the
        // transaction (including the animal's current tag) still goes up.
        if (error && isDuplicateKeyError(error)) {
          return;
        }
        if (error) {
          throw error;
        }
        break;
      }
      case UpdateType.PATCH: {
        const { id, ...patch } = record;
        const { data, error } = await supabase
          .from(table)
          .update(patch)
          .eq('id', id)
          .select('id');
        if (error && isDuplicateKeyError(error)) {
          return;
        }
        if (error) {
          throw error;
        }
        if (!data?.length) {
          throw uploadRowRejectedError('update');
        }
        break;
      }
      case UpdateType.DELETE: {
        const { data, error } = await supabase
          .from(table)
          .delete()
          .eq('id', op.id)
          .select('id');
        if (error) {
          throw error;
        }
        if (!data?.length) {
          throw uploadRowRejectedError('delete');
        }
        break;
      }
      default: {
        const unexpected: never = op.op;
        throw new Error(`Unexpected CRUD operation: ${unexpected}`);
      }
    }
  }
}
