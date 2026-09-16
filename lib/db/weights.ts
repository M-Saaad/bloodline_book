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
