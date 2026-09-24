import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { dbNow } from '@/lib/db/now';
import {
  deleteOpenTasksForHealthRecord,
  syncOpenTasksForHealthRecord,
} from '@/lib/db/health-task-sync';
import { mapHealthRecord } from '@/lib/db/mappers';
import {
  famachaFollowUpTaskTitle,
  healthKindSupportsWithdrawal,
  needsFamachaFollowUp,
  withdrawalClearDate,
  withdrawalTaskTitle,
} from '@/lib/domain/health';
import { addDaysToIso } from '@/lib/dates';
import { powersync } from '@/lib/powersync/system';
import type { HealthRecord, HealthRecordKind } from '@/lib/types/health';

async function insertHealthTask(
  tx: Transaction,
  farmId: string,
  input: {
    title: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    source: 'health' | 'famacha_check';
    sourceId: string;
  },
): Promise<void> {
  const id = Crypto.randomUUID();
  const now = dbNow();
  await tx.execute(
    `INSERT INTO tasks (
      id, farm_id, title, due_date, priority, source, source_id, completed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      farmId,
      input.title,
      input.dueDate,
      input.priority,
      input.source,
      input.sourceId,
      now,
      now,
    ],
  );
}

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
    animalLabel?: string;
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = dbNow();
  const animalLabel = input.animalLabel ?? 'Animal';

  const famachaScore =
    input.kind === 'famacha' ? (input.famachaScore ?? null) : null;
  const withdrawalDays =
    healthKindSupportsWithdrawal(input.kind) && input.withdrawalDays != null
      ? input.withdrawalDays
      : null;

  const scheduleFamacha =
    input.kind === 'famacha' &&
    famachaScore != null &&
    needsFamachaFollowUp(famachaScore);
  const famachaDue = scheduleFamacha
    ? addDaysToIso(input.date, 7) ?? input.date
    : null;

  const withdrawalDue =
    withdrawalDays != null
      ? withdrawalClearDate(input.date, withdrawalDays)
      : null;

  const runInsert = async (tx: Transaction) => {
    await tx.execute(
      `INSERT INTO health_records (
        id, farm_id, animal_id, date, kind, famacha_score,
        product_name, dosage, withdrawal_days, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        farmId,
        input.animalId,
        input.date,
        input.kind,
        famachaScore,
        input.productName ?? null,
        input.dosage ?? null,
        withdrawalDays,
        input.notes ?? null,
        now,
        now,
      ],
    );

    if (scheduleFamacha && famachaDue) {
      await insertHealthTask(tx, farmId, {
        title: famachaFollowUpTaskTitle(animalLabel),
        dueDate: famachaDue,
        priority: famachaScore! >= 5 ? 'high' : 'medium',
        source: 'famacha_check',
        sourceId: id,
      });
    }

    if (withdrawalDue) {
      await insertHealthTask(tx, farmId, {
        title: withdrawalTaskTitle(animalLabel, input.productName ?? null),
        dueDate: withdrawalDue,
        priority: 'high',
        source: 'health',
        sourceId: id,
      });
    }
  };

  await powersync.writeTransaction(runInsert);

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

export async function getHealthRecordById(
  recordId: string,
): Promise<HealthRecord | null> {
  const row = await powersync.getOptional<Record<string, unknown>>(
    'SELECT * FROM health_records WHERE id = ?',
    [recordId],
  );
  return row ? mapHealthRecord(row) : null;
}

export async function updateHealthRecord(
  recordId: string,
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
    animalLabel?: string;
  },
): Promise<void> {
  const now = dbNow();
  const animalLabel = input.animalLabel ?? 'Animal';

  const famachaScore =
    input.kind === 'famacha' ? (input.famachaScore ?? null) : null;
  const withdrawalDays =
    healthKindSupportsWithdrawal(input.kind) && input.withdrawalDays != null
      ? input.withdrawalDays
      : null;

  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `UPDATE health_records SET
        animal_id = ?, date = ?, kind = ?, famacha_score = ?,
        product_name = ?, dosage = ?, withdrawal_days = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.animalId,
        input.date,
        input.kind,
        famachaScore,
        input.productName ?? null,
        input.dosage ?? null,
        withdrawalDays,
        input.notes ?? null,
        now,
        recordId,
      ],
    );

    await syncOpenTasksForHealthRecord(tx, farmId, recordId, {
      animalId: input.animalId,
      date: input.date,
      kind: input.kind,
      famachaScore,
      productName: input.productName ?? null,
      withdrawalDays,
      animalLabel,
    });
  });
}

export async function deleteHealthRecord(recordId: string): Promise<void> {
  await powersync.writeTransaction(async (tx: Transaction) => {
    await deleteOpenTasksForHealthRecord(tx, recordId);
    await tx.execute('DELETE FROM health_records WHERE id = ?', [recordId]);
  });
}
