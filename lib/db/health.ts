import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { dbNow } from '@/lib/db/now';
import {
  closeOlderFamachaRechecks,
  deleteOpenTasksForHealthRecord,
  syncOpenTasksForHealthRecord,
} from '@/lib/db/health-task-sync';
import { mapHealthRecord } from '@/lib/db/mappers';
import {
  activeWithdrawalsByAnimal,
  dewormTaskTitle,
  healthKindSupportsWithdrawal,
  type WithdrawalBadge,
} from '@/lib/domain/health';
import { powersync } from '@/lib/powersync/system';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import type {
  HealthRecord,
  HealthRecordKind,
  TreatmentRoute,
} from '@/lib/types/health';

export type HealthRecordWrite = {
  animalId: string;
  date: string;
  kind: HealthRecordKind;
  famachaScore?: number;
  productName?: string;
  dosage?: string;
  withdrawalDays?: number;
  meatWithdrawalDays?: number | null;
  milkWithdrawalDays?: number | null;
  route?: TreatmentRoute | null;
  lotNumber?: string | null;
  notes?: string;
  animalLabel?: string;
  famachaRecheckDays?: number;
};

function resolveWithdrawal(input: HealthRecordWrite): {
  meat: number | null;
  milk: number | null;
  legacy: number | null;
} {
  if (!healthKindSupportsWithdrawal(input.kind)) {
    return { meat: null, milk: null, legacy: null };
  }

  const hasSplit =
    input.meatWithdrawalDays !== undefined ||
    input.milkWithdrawalDays !== undefined;
  if (hasSplit) {
    const meat = input.meatWithdrawalDays ?? null;
    const milk = input.milkWithdrawalDays ?? null;
    return { meat, milk, legacy: meat };
  }

  const legacy = input.withdrawalDays ?? null;
  return { meat: legacy, milk: legacy, legacy };
}

export async function createHealthRecord(
  farmId: string,
  input: HealthRecordWrite,
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = dbNow();
  const animalLabel = input.animalLabel ?? 'Animal';

  const famachaScore =
    input.kind === 'famacha' ? (input.famachaScore ?? null) : null;
  const withdrawal = resolveWithdrawal(input);
  const route = input.route ?? null;
  const lotNumber = input.lotNumber?.trim() ? input.lotNumber.trim() : null;

  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `INSERT INTO health_records (
        id, farm_id, animal_id, date, kind, famacha_score,
        product_name, dosage, withdrawal_days, meat_withdrawal_days,
        milk_withdrawal_days, route, lot_number, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        farmId,
        input.animalId,
        input.date,
        input.kind,
        famachaScore,
        input.productName ?? null,
        input.dosage ?? null,
        withdrawal.legacy,
        withdrawal.meat,
        withdrawal.milk,
        route,
        lotNumber,
        input.notes ?? null,
        now,
        now,
      ],
    );

    if (input.kind === 'famacha') {
      await closeOlderFamachaRechecks(tx, input.animalId, id);
    }

    await syncOpenTasksForHealthRecord(tx, farmId, id, {
      animalId: input.animalId,
      date: input.date,
      kind: input.kind,
      famachaScore,
      productName: input.productName ?? null,
      meatWithdrawalDays: withdrawal.meat,
      milkWithdrawalDays: withdrawal.milk,
      animalLabel,
      famachaRecheckDays: input.famachaRecheckDays,
    });
  });

  return id;
}

export async function createDewormFollowUpTask(
  farmId: string,
  input: {
    healthRecordId: string;
    animalLabel: string;
    famachaScore: number;
    dueDate: string;
  },
): Promise<void> {
  const id = Crypto.randomUUID();
  const now = dbNow();
  const goat = await powersync.getOptional<{
    id: string;
    name: string | null;
    tag_number: string | null;
  }>(
    `SELECT a.id, a.name, a.tag_number
     FROM health_records h
     JOIN animals a ON a.id = h.animal_id
     WHERE h.id = ?`,
    [input.healthRecordId],
  );
  const animalLabel = goat
    ? animalDisplayLabel({
        id: String(goat.id),
        name: goat.name,
        tagNumber: goat.tag_number,
      })
    : input.animalLabel;
  await powersync.execute(
    `INSERT INTO tasks (
      id, farm_id, title, due_date, priority, source, source_id, completed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'high', 'deworm', ?, 0, ?, ?)`,
    [
      id,
      farmId,
      dewormTaskTitle(animalLabel, input.famachaScore),
      input.dueDate,
      input.healthRecordId,
      now,
      now,
    ],
  );
}

export async function getActiveMeatWithdrawal(
  animalId: string,
  today: string,
): Promise<WithdrawalBadge | null> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT animal_id, date, product_name, meat_withdrawal_days,
            milk_withdrawal_days, withdrawal_days
     FROM health_records
     WHERE animal_id = ?`,
    [animalId],
  );
  const badges = activeWithdrawalsByAnimal(
    rows.map((row) => ({
      animalId: String(row.animal_id),
      date: String(row.date),
      productName:
        row.product_name != null ? String(row.product_name) : null,
      meatDays:
        row.meat_withdrawal_days != null
          ? Number(row.meat_withdrawal_days)
          : null,
      milkDays:
        row.milk_withdrawal_days != null
          ? Number(row.milk_withdrawal_days)
          : null,
      legacyDays:
        row.withdrawal_days != null ? Number(row.withdrawal_days) : null,
    })),
    today,
  );
  return badges.get(animalId)?.meat ?? null;
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
  input: HealthRecordWrite,
): Promise<void> {
  const now = dbNow();
  const animalLabel = input.animalLabel ?? 'Animal';

  const famachaScore =
    input.kind === 'famacha' ? (input.famachaScore ?? null) : null;
  const withdrawal = resolveWithdrawal(input);
  const route = input.route ?? null;
  const lotNumber = input.lotNumber?.trim() ? input.lotNumber.trim() : null;

  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `UPDATE health_records SET
        animal_id = ?, date = ?, kind = ?, famacha_score = ?,
        product_name = ?, dosage = ?, withdrawal_days = ?,
        meat_withdrawal_days = ?, milk_withdrawal_days = ?,
        route = ?, lot_number = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.animalId,
        input.date,
        input.kind,
        famachaScore,
        input.productName ?? null,
        input.dosage ?? null,
        withdrawal.legacy,
        withdrawal.meat,
        withdrawal.milk,
        route,
        lotNumber,
        input.notes ?? null,
        now,
        recordId,
      ],
    );

    if (input.kind === 'famacha') {
      await closeOlderFamachaRechecks(tx, input.animalId, recordId);
    }

    await syncOpenTasksForHealthRecord(tx, farmId, recordId, {
      animalId: input.animalId,
      date: input.date,
      kind: input.kind,
      famachaScore,
      productName: input.productName ?? null,
      meatWithdrawalDays: withdrawal.meat,
      milkWithdrawalDays: withdrawal.milk,
      animalLabel,
      famachaRecheckDays: input.famachaRecheckDays,
    });
  });
}

export async function deleteHealthRecord(recordId: string): Promise<void> {
  await powersync.writeTransaction(async (tx: Transaction) => {
    await deleteOpenTasksForHealthRecord(tx, recordId);
    await tx.execute('DELETE FROM health_records WHERE id = ?', [recordId]);
  });
}
