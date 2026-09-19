import * as Crypto from 'expo-crypto';

import { mapDocument, mapTask } from '@/lib/db/mappers';
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
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO documents (
      id, farm_id, animal_id, type, title, storage_path, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      farmId,
      input.animalId ?? null,
      input.type,
      input.title,
      null,
      input.notes ?? null,
      now,
    ],
  );

  return id;
}

export async function getTasksForFarm(farmId: string): Promise<FarmTask[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM tasks
     WHERE farm_id = ?
     ORDER BY completed ASC, due_date ASC NULLS LAST, created_at DESC`,
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
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO tasks (
      id, farm_id, title, due_date, priority, source, completed, created_at
    ) VALUES (?, ?, ?, ?, ?, 'manual', 0, ?)`,
    [
      id,
      farmId,
      input.title,
      input.dueDate ?? null,
      input.priority ?? 'medium',
      now,
    ],
  );

  return id;
}

export async function setTaskCompleted(
  taskId: string,
  completed: boolean,
): Promise<void> {
  await powersync.execute(
    'UPDATE tasks SET completed = ? WHERE id = ?',
    [completed ? 1 : 0, taskId],
  );
}
