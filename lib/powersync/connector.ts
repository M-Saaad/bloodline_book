import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/common';

import { supabase } from '@/lib/supabase/client';

const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '';

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      throw new Error('Not signed in');
    }

    return {
      endpoint: POWERSYNC_URL,
      token: session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    let lastError: Error | null = null;

    try {
      for (const op of transaction.crud) {
        await this.applyCrud(op);
      }
      await transaction.complete();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error('PowerSync upload error:', lastError);
    }

    if (lastError) {
      throw lastError;
    }
  }

  private async applyCrud(op: CrudEntry): Promise<void> {
    const table = op.table;
    const record = { ...op.opData, id: op.id };

    switch (op.op) {
      case UpdateType.PUT: {
        const { error } = await supabase.from(table).upsert(record);
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
