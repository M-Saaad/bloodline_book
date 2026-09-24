import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { mapWeighSession, mapWeightLog } from '@/lib/db/mappers';
import { dbNow } from '@/lib/db/now';
import { powersync } from '@/lib/powersync/system';
import type { WeighSession, WeightLog } from '@/lib/types/weight';

export interface WeighDayEntry {
  animalId: string;
  weightValue: number;
}

export async function createWeighSessionWithLogs(
  farmId: string,
  input: {
    date: string;
    weighPoint: WeighSession['weighPoint'];
    notes?: string;
    weightUnit: 'lb' | 'kg';
    entries: WeighDayEntry[];
    markWeaned?: boolean;
  },
): Promise<string> {
  const sessionId = Crypto.randomUUID();
  const now = dbNow();

  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `INSERT INTO weigh_sessions (id, farm_id, date, weigh_point, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        farmId,
        input.date,
        input.weighPoint,
        input.notes ?? null,
        now,
        now,
      ],
    );

    for (const entry of input.entries) {
      const logId = Crypto.randomUUID();
      await tx.execute(
        `INSERT INTO weight_logs (
          id, farm_id, weigh_session_id, animal_id, weight_value, weight_unit, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logId,
          farmId,
          sessionId,
          entry.animalId,
          entry.weightValue,
          input.weightUnit,
          now,
          now,
        ],
      );

      if (input.markWeaned && input.weighPoint === 'weaning') {
        const animal = await tx.getOptional<{
          lifecycle_stage: string;
          litter_id: string | null;
        }>(
          'SELECT lifecycle_stage, litter_id FROM animals WHERE id = ?',
          [entry.animalId],
        );
        if (animal?.lifecycle_stage === 'kid') {
          await tx.execute(
            `UPDATE animals SET lifecycle_stage = 'weaned', updated_at = ? WHERE id = ?`,
            [now, entry.animalId],
          );
          if (animal.litter_id) {
            await tx.execute(
              `UPDATE tasks SET completed = 1, updated_at = ?
               WHERE source = 'weaning' AND source_id = ? AND completed = 0`,
              [now, animal.litter_id],
            );
          }
        }
      }
    }
  });

  return sessionId;
}

export async function getWeighSessionById(
  sessionId: string,
): Promise<WeighSession | null> {
  const row = await powersync.getOptional<Record<string, unknown>>(
    'SELECT * FROM weigh_sessions WHERE id = ?',
    [sessionId],
  );
  return row ? mapWeighSession(row) : null;
}

export async function getWeightLogById(
  logId: string,
): Promise<WeightLog | null> {
  const row = await powersync.getOptional<Record<string, unknown>>(
    'SELECT * FROM weight_logs WHERE id = ?',
    [logId],
  );
  return row ? mapWeightLog(row) : null;
}

export async function updateWeightLog(
  logId: string,
  weightValue: number,
): Promise<void> {
  const now = dbNow();
  await powersync.execute(
    'UPDATE weight_logs SET weight_value = ?, updated_at = ? WHERE id = ?',
    [weightValue, now, logId],
  );
}

export async function deleteWeightLog(logId: string): Promise<void> {
  await powersync.writeTransaction(async (tx: Transaction) => {
    const row = await tx.getOptional<Record<string, unknown>>(
      'SELECT weigh_session_id FROM weight_logs WHERE id = ?',
      [logId],
    );
    if (!row) {
      return;
    }
    const sessionId = String(row.weigh_session_id);
    await tx.execute('DELETE FROM weight_logs WHERE id = ?', [logId]);

    const remaining = await tx.getOptional<{ count: number }>(
      'SELECT COUNT(*) as count FROM weight_logs WHERE weigh_session_id = ?',
      [sessionId],
    );
    if (Number(remaining?.count ?? 0) === 0) {
      await tx.execute('DELETE FROM weigh_sessions WHERE id = ?', [sessionId]);
    }
  });
}

export async function deleteWeighSession(sessionId: string): Promise<void> {
  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      'DELETE FROM weight_logs WHERE weigh_session_id = ?',
      [sessionId],
    );
    await tx.execute('DELETE FROM weigh_sessions WHERE id = ?', [sessionId]);
  });
}

export async function getRecentWeighSessions(
  farmId: string,
  limit = 10,
): Promise<WeighSession[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM weigh_sessions
     WHERE farm_id = ?
     ORDER BY date DESC, created_at DESC
     LIMIT ?`,
    [farmId, limit],
  );
  return rows.map(mapWeighSession);
}

export async function getWeightLogsForSession(
  sessionId: string,
): Promise<WeightLog[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM weight_logs WHERE weigh_session_id = ? ORDER BY created_at`,
    [sessionId],
  );
  return rows.map(mapWeightLog);
}

export interface AnimalWeightEntry {
  id: string;
  date: string;
  weighPoint: WeighSession['weighPoint'];
  weightValue: number;
  weightUnit: WeightLog['weightUnit'];
}

export async function getWeightHistoryForAnimal(
  animalId: string,
): Promise<AnimalWeightEntry[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT wl.id, ws.date, ws.weigh_point, wl.weight_value, wl.weight_unit
     FROM weight_logs wl
     JOIN weigh_sessions ws ON ws.id = wl.weigh_session_id
     WHERE wl.animal_id = ?
     ORDER BY ws.date DESC, wl.created_at DESC`,
    [animalId],
  );

  return rows.map((row) => ({
    id: String(row.id),
    date: String(row.date),
    weighPoint: row.weigh_point as WeighSession['weighPoint'],
    weightValue: Number(row.weight_value),
    weightUnit: row.weight_unit as WeightLog['weightUnit'],
  }));
}
