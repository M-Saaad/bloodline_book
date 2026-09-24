import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { dbNow } from '@/lib/db/now';
import {
  DEFAULT_FAMACHA_RECHECK_DAYS,
  famachaFollowUpTaskTitle,
  healthKindSupportsWithdrawal,
  meatWithdrawalTaskTitle,
  milkWithdrawalTaskTitle,
  needsFamachaFollowUp,
  withdrawalClearDate,
} from '@/lib/domain/health';
import { addDaysToIso } from '@/lib/dates';
import type { HealthRecordKind } from '@/lib/types/health';

type OpenHealthTask = {
  id: string;
  source: string;
};

const FOLLOW_UP_SOURCES = [
  'health',
  'meat_withdrawal',
  'milk_withdrawal',
  'famacha_check',
  'deworm',
] as const;

async function upsertTask(
  tx: Transaction,
  farmId: string,
  existingId: string | undefined,
  input: {
    title: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    source: string;
    sourceId: string;
  },
): Promise<void> {
  const now = dbNow();
  if (existingId) {
    await tx.execute(
      `UPDATE tasks
       SET title = ?, due_date = ?, priority = ?, source = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.title,
        input.dueDate,
        input.priority,
        input.source,
        now,
        existingId,
      ],
    );
    return;
  }

  const id = Crypto.randomUUID();
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

export async function syncOpenTasksForHealthRecord(
  tx: Transaction,
  farmId: string,
  healthRecordId: string,
  input: {
    animalId: string;
    date: string;
    kind: HealthRecordKind;
    famachaScore: number | null;
    productName: string | null;
    meatWithdrawalDays: number | null;
    milkWithdrawalDays: number | null;
    animalLabel: string;
    famachaRecheckDays?: number;
  },
): Promise<void> {
  const openTasks = await tx.getAll<OpenHealthTask>(
    `SELECT id, source FROM tasks
     WHERE source_id = ? AND completed = 0 AND source IN (${FOLLOW_UP_SOURCES.map(() => '?').join(', ')})`,
    [healthRecordId, ...FOLLOW_UP_SOURCES],
  );

  const supportsWithdrawal = healthKindSupportsWithdrawal(input.kind);
  const meatDue =
    supportsWithdrawal &&
    input.meatWithdrawalDays != null &&
    input.meatWithdrawalDays > 0
      ? withdrawalClearDate(input.date, input.meatWithdrawalDays)
      : null;
  const milkDue =
    supportsWithdrawal &&
    input.milkWithdrawalDays != null &&
    input.milkWithdrawalDays > 0
      ? withdrawalClearDate(input.date, input.milkWithdrawalDays)
      : null;

  const legacy = openTasks.find((task) => task.source === 'health');
  const meatTask = openTasks.find((task) => task.source === 'meat_withdrawal');
  const milkTask = openTasks.find((task) => task.source === 'milk_withdrawal');
  const famachaTask = openTasks.find((task) => task.source === 'famacha_check');
  const dewormTask = openTasks.find((task) => task.source === 'deworm');

  const meatExisting = meatTask?.id ?? legacy?.id;

  if (meatDue) {
    await upsertTask(tx, farmId, meatExisting, {
      title: meatWithdrawalTaskTitle(input.animalLabel, input.productName),
      dueDate: meatDue,
      priority: 'high',
      source: 'meat_withdrawal',
      sourceId: healthRecordId,
    });
    if (legacy && meatTask && legacy.id !== meatTask.id) {
      await tx.execute('DELETE FROM tasks WHERE id = ?', [legacy.id]);
    }
  } else if (meatTask) {
    await tx.execute('DELETE FROM tasks WHERE id = ?', [meatTask.id]);
    if (legacy) {
      await tx.execute('DELETE FROM tasks WHERE id = ?', [legacy.id]);
    }
  } else if (legacy && !milkDue) {
    await tx.execute('DELETE FROM tasks WHERE id = ?', [legacy.id]);
  }

  if (milkDue) {
    await upsertTask(tx, farmId, milkTask?.id, {
      title: milkWithdrawalTaskTitle(input.animalLabel, input.productName),
      dueDate: milkDue,
      priority: 'high',
      source: 'milk_withdrawal',
      sourceId: healthRecordId,
    });
  } else if (milkTask) {
    await tx.execute('DELETE FROM tasks WHERE id = ?', [milkTask.id]);
  }

  const recheckDays = input.famachaRecheckDays ?? DEFAULT_FAMACHA_RECHECK_DAYS;
  const famachaDue =
    input.kind === 'famacha' &&
    input.famachaScore != null &&
    needsFamachaFollowUp(input.famachaScore)
      ? addDaysToIso(input.date, recheckDays) ?? input.date
      : null;

  if (famachaDue && input.famachaScore != null) {
    await upsertTask(tx, farmId, famachaTask?.id, {
      title: famachaFollowUpTaskTitle(input.animalLabel),
      dueDate: famachaDue,
      priority: input.famachaScore >= 5 ? 'high' : 'medium',
      source: 'famacha_check',
      sourceId: healthRecordId,
    });
  } else if (famachaTask) {
    await tx.execute('DELETE FROM tasks WHERE id = ?', [famachaTask.id]);
  }

  if (
    dewormTask &&
    (input.kind !== 'famacha' ||
      input.famachaScore == null ||
      !needsFamachaFollowUp(input.famachaScore))
  ) {
    await tx.execute('DELETE FROM tasks WHERE id = ?', [dewormTask.id]);
  }
}

export async function deleteOpenTasksForHealthRecord(
  tx: Transaction,
  healthRecordId: string,
): Promise<void> {
  await tx.execute(
    `DELETE FROM tasks
     WHERE source_id = ? AND completed = 0 AND source IN (${FOLLOW_UP_SOURCES.map(() => '?').join(', ')})`,
    [healthRecordId, ...FOLLOW_UP_SOURCES],
  );
}

export async function closeOlderFamachaRechecks(
  tx: Transaction,
  animalId: string,
  exceptRecordId: string,
): Promise<void> {
  const now = dbNow();
  await tx.execute(
    `UPDATE tasks
     SET completed = 1, updated_at = ?
     WHERE completed = 0
       AND source = 'famacha_check'
       AND source_id IN (
         SELECT id FROM health_records
         WHERE animal_id = ? AND id != ?
       )`,
    [now, animalId, exceptRecordId],
  );
}
