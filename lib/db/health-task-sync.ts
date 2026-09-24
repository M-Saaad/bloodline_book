import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { dbNow } from '@/lib/db/now';
import {
  famachaFollowUpTaskTitle,
  healthKindSupportsWithdrawal,
  needsFamachaFollowUp,
  withdrawalClearDate,
  withdrawalTaskTitle,
} from '@/lib/domain/health';
import { addDaysToIso } from '@/lib/dates';
import type { HealthRecordKind } from '@/lib/types/health';

type OpenHealthTask = {
  id: string;
  source: string;
};

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
    withdrawalDays: number | null;
    animalLabel: string;
  },
): Promise<void> {
  const openTasks = await tx.getAll<OpenHealthTask>(
    `SELECT id, source FROM tasks
     WHERE source_id = ? AND completed = 0 AND source IN ('health', 'famacha_check')`,
    [healthRecordId],
  );

  const withdrawalDue =
    input.withdrawalDays != null &&
    healthKindSupportsWithdrawal(input.kind) &&
    input.withdrawalDays > 0
      ? withdrawalClearDate(input.date, input.withdrawalDays)
      : null;

  const famachaDue =
    input.kind === 'famacha' &&
    input.famachaScore != null &&
    needsFamachaFollowUp(input.famachaScore)
      ? addDaysToIso(input.date, 7) ?? input.date
      : null;

  const withdrawalTask = openTasks.find((task) => task.source === 'health');
  const famachaTask = openTasks.find((task) => task.source === 'famacha_check');

  const now = dbNow();

  if (withdrawalDue) {
    const title = withdrawalTaskTitle(input.animalLabel, input.productName);
    if (withdrawalTask) {
      await tx.execute(
        'UPDATE tasks SET title = ?, due_date = ?, updated_at = ? WHERE id = ?',
        [title, withdrawalDue, now, withdrawalTask.id],
      );
    } else {
      const id = Crypto.randomUUID();
      await tx.execute(
        `INSERT INTO tasks (
          id, farm_id, title, due_date, priority, source, source_id, completed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'high', 'health', ?, 0, ?, ?)`,
        [id, farmId, title, withdrawalDue, healthRecordId, now, now],
      );
    }
  } else if (withdrawalTask) {
    await tx.execute('DELETE FROM tasks WHERE id = ?', [withdrawalTask.id]);
  }

  if (famachaDue && input.famachaScore != null) {
    const title = famachaFollowUpTaskTitle(input.animalLabel);
    const priority = input.famachaScore >= 5 ? 'high' : 'medium';
    if (famachaTask) {
      await tx.execute(
        'UPDATE tasks SET title = ?, due_date = ?, priority = ?, updated_at = ? WHERE id = ?',
        [title, famachaDue, priority, now, famachaTask.id],
      );
    } else {
      const id = Crypto.randomUUID();
      await tx.execute(
        `INSERT INTO tasks (
          id, farm_id, title, due_date, priority, source, source_id, completed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'famacha_check', ?, 0, ?, ?)`,
        [id, farmId, title, famachaDue, priority, healthRecordId, now, now],
      );
    }
  } else if (famachaTask) {
    await tx.execute('DELETE FROM tasks WHERE id = ?', [famachaTask.id]);
  }
}

export async function deleteOpenTasksForHealthRecord(
  tx: Transaction,
  healthRecordId: string,
): Promise<void> {
  await tx.execute(
    `DELETE FROM tasks
     WHERE source_id = ? AND completed = 0 AND source IN ('health', 'famacha_check')`,
    [healthRecordId],
  );
}
