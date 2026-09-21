import * as Crypto from 'expo-crypto';

import { mapHealthRecord } from '@/lib/db/mappers';
import { powersync } from '@/lib/powersync/system';
import type { HealthRecord, HealthRecordKind } from '@/lib/types/health';

export async function createHealthRecord(
  farmId: string,
  input: {
    animalId: string;
    date: string;
    kind: HealthRecordKind;
    famachaScore?: number;
    productName?: string;
    dosage?: string;
    withdrawalDays?: number;
    notes?: string;
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO health_records (
      id, farm_id, animal_id, date, kind, famacha_score,
      product_name, dosage, withdrawal_days, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      farmId,
      input.animalId,
      input.date,
      input.kind,
      input.famachaScore ?? null,
      input.productName ?? null,
      input.dosage ?? null,
      input.withdrawalDays ?? null,
      input.notes ?? null,
      now,
    ],
  );

  return id;
}

export async function getHealthRecordsForFarm(
  farmId: string,
): Promise<HealthRecord[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM health_records
     WHERE farm_id = ?
     ORDER BY date DESC, created_at DESC`,
    [farmId],
  );
  return rows.map(mapHealthRecord);
}

export async function getHealthRecordsForAnimal(
  animalId: string,
): Promise<HealthRecord[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM health_records
     WHERE animal_id = ?
     ORDER BY date DESC, created_at DESC`,
    [animalId],
  );
  return rows.map(mapHealthRecord);
}
