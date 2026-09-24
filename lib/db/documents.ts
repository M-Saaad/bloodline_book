import * as Crypto from 'expo-crypto';

import { mapDocument, mapTask } from '@/lib/db/mappers';
import { dbNow } from '@/lib/db/now';
import { ORDER_TASKS_BY_DUE } from '@/lib/sql/portableOrder';
import { powersync } from '@/lib/powersync/system';
import type { FarmDocument, FarmTask } from '@/lib/types/documents';

export async function getDocumentsForFarm(
  farmId: string,
): Promise<FarmDocument[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM documents
     WHERE farm_id = ?
     ORDER BY created_at DESC`,
    [farmId],
  );
  return rows.map(mapDocument);
}

export async function createDocument(
  farmId: string,
  input: {
    type: FarmDocument['type'];
    title: string;
    notes?: string;
    animalId?: string;
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = dbNow();

  await powersync.execute(
    `INSERT INTO documents (
      id, farm_id, animal_id, type, title, storage_path, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      farmId,
      input.animalId ?? null,
      input.type,
      input.title,
      null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return id;
}

export async function getTasksForFarm(farmId: string): Promise<FarmTask[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM tasks
     WHERE farm_id = ?
     ORDER BY ${ORDER_TASKS_BY_DUE}`,
    [farmId],
  );
  return rows.map(mapTask);
}

export async function createTask(
  farmId: string,
  input: {
    title: string;
    dueDate?: string;
    priority?: FarmTask['priority'];
    source?: FarmTask['source'];
    sourceId?: string;
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = dbNow();

  await powersync.execute(
    `INSERT INTO tasks (
      id, farm_id, title, due_date, priority, source, source_id, completed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      farmId,
      input.title,
      input.dueDate ?? null,
      input.priority ?? 'medium',
      input.source ?? 'manual',
      input.sourceId ?? null,
      now,
      now,
    ],
  );

  return id;
}

export async function getTaskById(taskId: string): Promise<FarmTask | null> {
  const row = await powersync.getOptional<Record<string, unknown>>(
    'SELECT * FROM tasks WHERE id = ?',
    [taskId],
  );
  return row ? mapTask(row) : null;
}

export async function updateTask(
  taskId: string,
  input: {
    title: string;
    dueDate?: string;
    priority?: FarmTask['priority'];
  },
): Promise<void> {
  const now = dbNow();
  await powersync.execute(
    `UPDATE tasks SET title = ?, due_date = ?, priority = ?, updated_at = ? WHERE id = ?`,
    [
      input.title,
      input.dueDate ?? null,
      input.priority ?? 'medium',
      now,
      taskId,
    ],
  );
}

export async function deleteTask(taskId: string): Promise<void> {
  await powersync.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
}

export async function setTaskCompleted(
  taskId: string,
  completed: boolean,
): Promise<void> {
  const now = dbNow();
  await powersync.execute(
    'UPDATE tasks SET completed = ?, updated_at = ? WHERE id = ?',
    [completed ? 1 : 0, now, taskId],
  );
}
