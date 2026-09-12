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
} from '@/lib/powersync/errors';
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

    let lastOp: CrudEntry | null = null;

    try {
      for (const op of transaction.crud) {
        lastOp = op;
        await this.applyCrud(op);
      }
      await transaction.complete();
    } catch (error) {
      const uploadError = toUploadError(error);
      console.error('PowerSync upload error:', formatUploadError(error), {
        table: lastOp?.table,
        op: lastOp?.op,
        id: lastOp?.id,
      });

      if (isFatalUploadError(error)) {
        console.error(
          'PowerSync upload error is not retryable — discarding transaction:',
          lastOp,
        );
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
        const { error } = await supabase.from(table).update(patch).eq('id', id);
        if (error) {
          throw error;
        }
        break;
      }
      case UpdateType.DELETE: {
        const { error } = await supabase.from(table).delete().eq('id', op.id);
        if (error) {
          throw error;
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
