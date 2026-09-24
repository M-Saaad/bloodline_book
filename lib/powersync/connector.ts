import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/common';

import { getPowerSyncUrl, isPowerSyncConfigured } from '@/lib/powersync/config';
import {
  formatUploadError,
  isDuplicateKeyError,
  isFatalUploadError,
  SERVER_MANAGED_UPLOAD_TABLES,
  toUploadError,
  uploadRowRejectedError,
} from '@/lib/powersync/errors';
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
    let failedOpIndex = 0;

    try {
      for (let index = 0; index < ops.length; index += 1) {
        failedOpIndex = index;
        await this.applyCrud(ops[index]);
      }
      await transaction.complete();
    } catch (error) {
      const uploadError = toUploadError(error);
      const failedOp = ops[failedOpIndex] ?? null;
      console.error('PowerSync upload error:', formatUploadError(error), {
        table: failedOp?.table,
        op: failedOp?.op,
        id: failedOp?.id,
      });

      if (isFatalUploadError(error)) {
        console.error(
          'PowerSync upload error is not retryable — recording and completing transaction:',
          failedOp,
        );
        try {
          await recordUploadTransactionFailures(
            database,
            ops,
            failedOpIndex,
            error,
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
      return;
    }

    const table = op.table;
    const record = this.buildRecord(op);

    switch (op.op) {
      case UpdateType.PUT: {
        // Use INSERT, not UPSERT: PostgREST upsert also evaluates UPDATE RLS, which
        // blocks new farm rows before on_farm_created adds farm_members membership.
        const { error } = await supabase.from(table).insert(record);
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
