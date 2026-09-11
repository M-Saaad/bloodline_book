import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { mapWeighSession, mapWeightLog } from '@/lib/db/mappers';
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
  },
): Promise<string> {
  const sessionId = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `INSERT INTO weigh_sessions (id, farm_id, date, weigh_point, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        farmId,
        input.date,
        input.weighPoint,
        input.notes ?? null,
        now,
      ],
    );

    for (const entry of input.entries) {
      const logId = Crypto.randomUUID();
      await tx.execute(
        `INSERT INTO weight_logs (
          id, farm_id, weigh_session_id, animal_id, weight_value, weight_unit, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          logId,
          farmId,
          sessionId,
          entry.animalId,
          entry.weightValue,
          input.weightUnit,
          now,
        ],
      );
    }
  });

  return sessionId;
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
