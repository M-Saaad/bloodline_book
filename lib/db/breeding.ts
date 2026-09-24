import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { getAnimalById } from '@/lib/db/animals';
import { dbNow } from '@/lib/db/now';
import { mapBreedingEvent, mapKiddingEvent } from '@/lib/db/mappers';
import { getFarmById } from '@/lib/db/farms';
import {
  computeBreedingWindow,
  isBreedingOpenForKidding,
  kidAnimalDefaultName,
  kiddingDueTaskTitle,
  resolveBreedingWindow,
  targetRegisteredKidCount,
  type DueWindow,
} from '@/lib/domain/breeding';
import { kidInheritsBreed, weaningTaskTitle } from '@/lib/domain/kidding';
import { addDaysToIso } from '@/lib/dates';
import { ORDER_DUE_DATE_DESC } from '@/lib/sql/portableOrder';
import { powersync } from '@/lib/powersync/system';
import type {
  BreedingEvent,
  BreedingStatus,
  ConfirmMethod,
  KiddingEase,
  KiddingEvent,
} from '@/lib/types/breeding';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';

async function syncOpenBreedingDueTask(
  tx: Transaction,
  farmId: string,
  breedingId: string,
  input: {
    window: DueWindow;
    damLabel: string;
    status: BreedingStatus;
  },
): Promise<void> {
  if (!isBreedingOpenForKidding(input.status)) {
    return;
  }

  const now = dbNow();
  const title = kiddingDueTaskTitle(
    input.damLabel,
    input.window.windowStart,
    input.window.windowEnd,
  );
  const openTask = await tx.getOptional<{ id: string }>(
    `SELECT id FROM tasks
     WHERE source_id = ? AND source = 'breeding' AND completed = 0
     LIMIT 1`,
    [breedingId],
  );

  if (openTask) {
    await tx.execute(
      'UPDATE tasks SET title = ?, due_date = ?, updated_at = ? WHERE id = ?',
      [title, input.window.windowStart, now, openTask.id],
    );
    return;
  }

  const id = Crypto.randomUUID();
  await tx.execute(
    `INSERT INTO tasks (
      id, farm_id, title, due_date, priority, source, source_id, completed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'high', 'breeding', ?, 0, ?, ?)`,
    [id, farmId, title, input.window.windowStart, breedingId, now, now],
  );
}

async function markBreedingsOpenInTx(
  tx: Transaction,
  breedingIds: string[],
): Promise<void> {
  const now = dbNow();
  for (const breedingId of breedingIds) {
    await tx.execute(
      `UPDATE breeding_events
       SET status = 'open', updated_at = ?
       WHERE id = ? AND status IN ('bred', 'confirmed')`,
      [now, breedingId],
    );
    await tx.execute(
      `UPDATE tasks
       SET completed = 1, updated_at = ?
       WHERE source = 'breeding' AND source_id = ? AND completed = 0`,
      [now, breedingId],
    );
  }
}

async function insertBreedingRow(
  tx: Transaction,
  farmId: string,
  id: string,
  input: {
    damId: string;
    sireId?: string;
    sireExternalName?: string;
    bredDate: string;
    exposureEndDate?: string | null;
    notes?: string;
    status?: BreedingStatus;
    window: DueWindow;
    damLabel?: string;
    scheduleDueTask?: boolean;
  },
): Promise<void> {
  const now = dbNow();
  const status = input.status ?? 'bred';
  await tx.execute(
    `INSERT INTO breeding_events (
      id, farm_id, dam_id, sire_id, sire_external_name,
      bred_date, exposure_end_date, due_date, due_window_start, due_window_end,
      status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      farmId,
      input.damId,
      input.sireId ?? null,
      input.sireExternalName ?? null,
      input.bredDate,
      input.exposureEndDate ?? null,
      input.window.dueDate,
      input.window.windowStart,
      input.window.windowEnd,
      status,
      input.notes ?? null,
      now,
      now,
    ],
  );

  if (input.scheduleDueTask !== false && input.damLabel) {
    await syncOpenBreedingDueTask(tx, farmId, id, {
      window: input.window,
      damLabel: input.damLabel,
      status,
    });
  }
}

export async function createBreedingEvent(
  farmId: string,
  input: {
    damId: string;
    sireId?: string;
    sireExternalName?: string;
    bredDate: string;
    exposureEndDate?: string | null;
    gestationDays?: number;
    status?: BreedingStatus;
    notes?: string;
    damLabel?: string;
    scheduleDueTask?: boolean;
    closeBreedingIds?: string[];
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const window = computeBreedingWindow({
    bredDate: input.bredDate,
    exposureEndDate: input.exposureEndDate,
    gestationDays: input.gestationDays ?? 150,
  });
  if (!window) {
    throw new Error('Enter a valid breeding date.');
  }

  await powersync.writeTransaction(async (tx: Transaction) => {
    await markBreedingsOpenInTx(tx, input.closeBreedingIds ?? []);
    await insertBreedingRow(tx, farmId, id, {
      ...input,
      window,
    });
  });

  return id;
}

export async function createExposureBreedings(
  farmId: string,
  input: {
    damIds: string[];
    sireId?: string;
    sireExternalName?: string;
    startDate: string;
    endDate: string;
    gestationDays?: number;
    notes?: string;
    damLabels: Record<string, string>;
    closeBreedingIds?: string[];
  },
): Promise<string[]> {
  const window = computeBreedingWindow({
    bredDate: input.startDate,
    exposureEndDate: input.endDate,
    gestationDays: input.gestationDays ?? 150,
  });
  if (!window) {
    throw new Error('Exposure end date must be on or after the start date.');
  }

  const ids = input.damIds.map(() => Crypto.randomUUID());
  await powersync.writeTransaction(async (tx: Transaction) => {
    await markBreedingsOpenInTx(tx, input.closeBreedingIds ?? []);
    for (let i = 0; i < input.damIds.length; i++) {
      const damId = input.damIds[i];
      await insertBreedingRow(tx, farmId, ids[i], {
        damId,
        sireId: input.sireId,
        sireExternalName: input.sireExternalName,
        bredDate: input.startDate,
        exposureEndDate: input.endDate,
        notes: input.notes,
        window,
        damLabel: input.damLabels[damId] ?? 'Dam',
        scheduleDueTask: true,
      });
    }
  });
  return ids;
}

export type KiddingKidDraft = {
  name?: string;
  tagNumber?: string;
  sex: 'male' | 'female';
  outcome?: 'alive' | 'dead';
  birthWeight?: number | null;
};

export async function createKiddingEvent(
  farmId: string,
  input: {
    damId: string;
    sireId?: string;
    sireExternalName?: string;
    kidDate: string;
    kidsBorn: number;
    kidsSurviving?: number;
    notes?: string;
    damLabel?: string;
    kiddingEase?: KiddingEase | null;
    breedingEventId?: string | null;
    weaningDays?: number | null;
    weightUnit?: 'lb' | 'kg';
    registerKids?: KiddingKidDraft[];
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = dbNow();
  const damLabel = input.damLabel ?? 'Dam';
  const drafts = input.registerKids ?? [];
  const aliveDrafts = drafts.filter((kid) => kid.outcome !== 'dead');

  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `INSERT INTO kidding_events (
        id, farm_id, dam_id, sire_id, sire_external_name,
        kid_date, kids_born, kids_surviving, kidding_ease, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        farmId,
        input.damId,
        input.sireId ?? null,
        input.sireExternalName ?? null,
        input.kidDate,
        input.kidsBorn,
        input.kidsSurviving ?? null,
        input.kiddingEase ?? null,
        input.notes ?? null,
        now,
        now,
      ],
    );

    if (input.breedingEventId) {
      const breeding = await tx.getOptional<Record<string, unknown>>(
        `SELECT id, status, dam_id FROM breeding_events WHERE id = ?`,
        [input.breedingEventId],
      );
      if (
        breeding &&
        String(breeding.dam_id) === input.damId &&
        isBreedingOpenForKidding(String(breeding.status) as BreedingStatus)
      ) {
        await tx.execute(
          `UPDATE breeding_events
           SET status = 'kidded', kidding_event_id = ?, updated_at = ?
           WHERE id = ?`,
          [id, now, String(breeding.id)],
        );
        await tx.execute(
          `UPDATE tasks
           SET completed = 1, updated_at = ?
           WHERE source = 'breeding' AND source_id = ? AND completed = 0`,
          [now, String(breeding.id)],
        );
      }
    }

    const damRow = await tx.getOptional<{ breed_primary_id: string | null }>(
      'SELECT breed_primary_id FROM animals WHERE id = ?',
      [input.damId],
    );
    let sireBreed: string | null = null;
    if (input.sireId) {
      const sireRow = await tx.getOptional<{ breed_primary_id: string | null }>(
        'SELECT breed_primary_id FROM animals WHERE id = ?',
        [input.sireId],
      );
      sireBreed = sireRow?.breed_primary_id ?? null;
    }
    const breedId = kidInheritsBreed(
      damRow?.breed_primary_id ?? null,
      sireBreed,
    );

    const weighed: { animalId: string; weight: number }[] = [];
    for (let i = 0; i < aliveDrafts.length; i++) {
      const kid = aliveDrafts[i];
      const kidId = Crypto.randomUUID();
      const name = kid.name?.trim()
        ? kid.name.trim()
        : kidAnimalDefaultName(damLabel, i + 1);
      await tx.execute(
        `INSERT INTO animals (
          id, farm_id, name, tag_number, sex, status, lifecycle_stage,
          purpose, breed_primary_id, date_of_birth, dam_id, sire_id,
          sire_external_name, litter_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'active', 'kid', NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          kidId,
          farmId,
          name,
          kid.tagNumber?.trim() ? kid.tagNumber.trim() : null,
          kid.sex,
          breedId,
          input.kidDate,
          input.damId,
          input.sireId ?? null,
          input.sireExternalName ?? null,
          id,
          now,
          now,
        ],
      );
      if (kid.birthWeight != null && kid.birthWeight > 0) {
        weighed.push({ animalId: kidId, weight: kid.birthWeight });
      }
    }

    if (weighed.length > 0) {
      const sessionId = Crypto.randomUUID();
      await tx.execute(
        `INSERT INTO weigh_sessions (id, farm_id, date, weigh_point, notes, created_at, updated_at)
         VALUES (?, ?, ?, 'birth', NULL, ?, ?)`,
        [sessionId, farmId, input.kidDate, now, now],
      );
      for (const entry of weighed) {
        await tx.execute(
          `INSERT INTO weight_logs (
            id, farm_id, weigh_session_id, animal_id, weight_value, weight_unit, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            Crypto.randomUUID(),
            farmId,
            sessionId,
            entry.animalId,
            entry.weight,
            input.weightUnit ?? 'lb',
            now,
            now,
          ],
        );
      }
    }

    const aliveCount = input.kidsSurviving ?? aliveDrafts.length;
    if (
      input.weaningDays != null &&
      input.weaningDays > 0 &&
      aliveCount > 0
    ) {
      const weanDue = addDaysToIso(input.kidDate, input.weaningDays);
      if (weanDue) {
        await tx.execute(
          `INSERT INTO tasks (
            id, farm_id, title, due_date, priority, source, source_id, completed, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'medium', 'weaning', ?, 0, ?, ?)`,
          [
            Crypto.randomUUID(),
            farmId,
            weaningTaskTitle(damLabel),
            weanDue,
            id,
            now,
            now,
          ],
        );
      }
    }
  });

  return id;
}

export async function getOpenBreedingsForDam(
  farmId: string,
  damId: string,
): Promise<BreedingEvent[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM breeding_events
     WHERE farm_id = ? AND dam_id = ? AND status IN ('bred', 'confirmed')
     ORDER BY bred_date DESC`,
    [farmId, damId],
  );
  return rows.map(mapBreedingEvent);
}

export async function confirmBreeding(
  breedingId: string,
  input: { confirmedDate: string; method: ConfirmMethod },
): Promise<void> {
  const now = dbNow();
  await powersync.execute(
    `UPDATE breeding_events
     SET status = 'confirmed', confirmed_date = ?, confirm_method = ?, updated_at = ?
     WHERE id = ?`,
    [input.confirmedDate, input.method, now, breedingId],
  );
}

export async function markBreedingOpen(breedingId: string): Promise<void> {
  await powersync.writeTransaction(async (tx: Transaction) => {
    await markBreedingsOpenInTx(tx, [breedingId]);
  });
}

export async function markBreedingLost(
  breedingId: string,
  note: string,
): Promise<void> {
  const existing = await getBreedingEventById(breedingId);
  const notes = [existing?.notes?.trim(), note.trim()].filter(Boolean).join('\n');
  const now = dbNow();
  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `UPDATE breeding_events
       SET status = 'lost', notes = ?, updated_at = ?
       WHERE id = ?`,
      [notes || null, now, breedingId],
    );
    await tx.execute(
      `UPDATE tasks
       SET completed = 1, updated_at = ?
       WHERE source = 'breeding' AND source_id = ? AND completed = 0`,
      [now, breedingId],
    );
  });
}

export async function getBreedingEventsForFarm(
  farmId: string,
): Promise<BreedingEvent[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM breeding_events
     WHERE farm_id = ?
     ORDER BY ${ORDER_DUE_DATE_DESC}`,
    [farmId],
  );
  return rows.map(mapBreedingEvent);
}

export async function getKiddingEventsForFarm(
  farmId: string,
): Promise<KiddingEvent[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM kidding_events
     WHERE farm_id = ?
     ORDER BY kid_date DESC, created_at DESC`,
    [farmId],
  );
  return rows.map(mapKiddingEvent);
}

export async function getUpcomingBreedingsForFarm(
  farmId: string,
  fromDate: string,
  toDate: string,
): Promise<BreedingEvent[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM breeding_events
     WHERE farm_id = ?
       AND due_date IS NOT NULL
       AND due_date >= ?
       AND due_date <= ?
       AND status IN ('bred', 'confirmed')
     ORDER BY due_date ASC, bred_date DESC`,
    [farmId, fromDate, toDate],
  );
  return rows.map(mapBreedingEvent);
}

export async function getBreedingEventById(
  breedingId: string,
): Promise<BreedingEvent | null> {
  const row = await powersync.getOptional<Record<string, unknown>>(
    'SELECT * FROM breeding_events WHERE id = ?',
    [breedingId],
  );
  return row ? mapBreedingEvent(row) : null;
}

export async function getKiddingEventById(
  kiddingId: string,
): Promise<KiddingEvent | null> {
  const row = await powersync.getOptional<Record<string, unknown>>(
    'SELECT * FROM kidding_events WHERE id = ?',
    [kiddingId],
  );
  return row ? mapKiddingEvent(row) : null;
}

export class BreedingLinkedToKiddingError extends Error {
  constructor() {
    super(
      'This breeding is linked to a kidding. Delete the kidding first.',
    );
    this.name = 'BreedingLinkedToKiddingError';
  }
}

export async function updateBreedingEvent(
  breedingId: string,
  input: {
    damId: string;
    sireId?: string;
    sireExternalName?: string;
    bredDate: string;
    exposureEndDate?: string | null;
    gestationDays?: number;
    notes?: string;
    damLabel?: string;
    status?: BreedingStatus;
  },
): Promise<void> {
  const existing = await getBreedingEventById(breedingId);
  const status = input.status ?? existing?.status ?? 'bred';
  const now = dbNow();
  const exposureEndDate =
    input.exposureEndDate !== undefined
      ? input.exposureEndDate
      : existing?.exposureEndDate;
  const window = computeBreedingWindow({
    bredDate: input.bredDate,
    exposureEndDate,
    gestationDays: input.gestationDays ?? 150,
  });
  if (!window) {
    throw new Error('Enter a valid breeding date.');
  }
  const damLabel = input.damLabel ?? 'Dam';
  const farmId = existing?.farmId;

  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `UPDATE breeding_events SET
        dam_id = ?, sire_id = ?, sire_external_name = ?,
        bred_date = ?, exposure_end_date = ?, due_date = ?,
        due_window_start = ?, due_window_end = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.damId,
        input.sireId ?? null,
        input.sireExternalName ?? null,
        input.bredDate,
        exposureEndDate ?? null,
        window.dueDate,
        window.windowStart,
        window.windowEnd,
        input.notes ?? null,
        now,
        breedingId,
      ],
    );

    if (farmId) {
      await syncOpenBreedingDueTask(tx, farmId, breedingId, {
        window,
        damLabel,
        status,
      });
    }
  });
}

/** Creates or updates the open expected-kidding task when breeding is still active. */
export async function ensureBreedingDueTask(breedingId: string): Promise<void> {
  const breeding = await getBreedingEventById(breedingId);
  if (!breeding) {
    return;
  }

  const farm = await getFarmById(breeding.farmId);
  const window = resolveBreedingWindow(
    breeding,
    farm?.gestationDays ?? 150,
  );
  if (!window) {
    return;
  }

  const dam = await getAnimalById(breeding.damId);
  const damLabel = dam ? animalDisplayLabel(dam) : 'Dam';

  await powersync.writeTransaction(async (tx: Transaction) => {
    await syncOpenBreedingDueTask(tx, breeding.farmId, breedingId, {
      window,
      damLabel,
      status: breeding.status,
    });
  });
}

export async function deleteBreedingEvent(breedingId: string): Promise<void> {
  const breeding = await getBreedingEventById(breedingId);
  if (!breeding) {
    return;
  }
  if (breeding.kiddingEventId) {
    throw new BreedingLinkedToKiddingError();
  }

  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `DELETE FROM tasks
       WHERE source_id = ? AND source = 'breeding' AND completed = 0`,
      [breedingId],
    );
    await tx.execute('DELETE FROM breeding_events WHERE id = ?', [breedingId]);
  });
}

export class KiddingLitterSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KiddingLitterSyncError';
  }
}

async function animalHasWeightOrHealth(
  tx: Transaction,
  animalId: string,
): Promise<boolean> {
  const weights = await tx.getOptional<{ count: number }>(
    'SELECT COUNT(*) as count FROM weight_logs WHERE animal_id = ?',
    [animalId],
  );
  const health = await tx.getOptional<{ count: number }>(
    'SELECT COUNT(*) as count FROM health_records WHERE animal_id = ?',
    [animalId],
  );
  return Number(weights?.count ?? 0) > 0 || Number(health?.count ?? 0) > 0;
}

async function syncKiddingLitterAnimals(
  tx: Transaction,
  kidding: KiddingEvent,
  input: {
    kidDate: string;
    kidsBorn: number;
    kidsSurviving?: number;
    sireId?: string;
    sireExternalName?: string;
  },
  damLabel: string,
): Promise<void> {
  const litterRows = await tx.getAll<Record<string, unknown>>(
    'SELECT id, name, tag_number FROM animals WHERE litter_id = ? ORDER BY created_at ASC',
    [kidding.id],
  );
  if (litterRows.length === 0) {
    return;
  }

  const now = dbNow();
  const targetCount = targetRegisteredKidCount(
    input.kidsBorn,
    input.kidsSurviving,
  );

  await tx.execute(
    `UPDATE animals SET
      date_of_birth = ?, sire_id = ?, sire_external_name = ?, updated_at = ?
     WHERE litter_id = ?`,
    [
      input.kidDate,
      input.sireId ?? null,
      input.sireExternalName ?? null,
      now,
      kidding.id,
    ],
  );

  if (targetCount < litterRows.length) {
    const toRemove = litterRows.length - targetCount;
    const deletableIds: string[] = [];
    const blockedLabels: string[] = [];

    for (const row of [...litterRows].reverse()) {
      if (deletableIds.length >= toRemove) {
        break;
      }
      const animalId = String(row.id);
      const label =
        row.name != null
          ? String(row.name)
          : row.tag_number != null
            ? `Tag ${String(row.tag_number)}`
            : 'Kid';
      if (await animalHasWeightOrHealth(tx, animalId)) {
        blockedLabels.push(label);
        continue;
      }
      deletableIds.push(animalId);
    }

    if (deletableIds.length < toRemove) {
      const names =
        blockedLabels.length > 0 ? ` (${blockedLabels.join(', ')})` : '';
      throw new KiddingLitterSyncError(
        `Need to remove ${toRemove} kid${toRemove === 1 ? '' : 's'} from Livestock but only ${deletableIds.length} can be removed${names}. Kids with weight or health records must be marked sold/dead or deleted individually first.`,
      );
    }

    for (const animalId of deletableIds) {
      await tx.execute('DELETE FROM animals WHERE id = ?', [animalId]);
    }
  } else if (targetCount > litterRows.length) {
    const toAdd = targetCount - litterRows.length;
    const startIndex = litterRows.length;
    for (let i = 0; i < toAdd; i++) {
      const kidId = Crypto.randomUUID();
      await tx.execute(
        `INSERT INTO animals (
          id, farm_id, name, tag_number, sex, status, lifecycle_stage,
          purpose, breed_primary_id, date_of_birth, dam_id, sire_id,
          sire_external_name, litter_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'active', 'kid', NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [
          kidId,
          kidding.farmId,
          kidAnimalDefaultName(damLabel, startIndex + i + 1),
          null,
          'female',
          input.kidDate,
          kidding.damId,
          input.sireId ?? null,
          input.sireExternalName ?? null,
          kidding.id,
          now,
          now,
        ],
      );
    }
  }
}

export async function updateKiddingEvent(
  kiddingId: string,
  input: {
    kidDate: string;
    kidsBorn: number;
    kidsSurviving?: number;
    sireId?: string;
    sireExternalName?: string;
    kiddingEase?: KiddingEase | null;
    notes?: string;
  },
): Promise<void> {
  const kidding = await getKiddingEventById(kiddingId);
  if (!kidding) {
    throw new Error('Kidding record not found.');
  }

  const dam = await getAnimalById(kidding.damId);
  const damLabel = dam ? animalDisplayLabel(dam) : 'Dam';
  const now = dbNow();

  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `UPDATE kidding_events SET
        kid_date = ?, kids_born = ?, kids_surviving = ?,
        sire_id = ?, sire_external_name = ?, kidding_ease = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.kidDate,
        input.kidsBorn,
        input.kidsSurviving ?? null,
        input.sireId ?? null,
        input.sireExternalName ?? null,
        input.kiddingEase !== undefined
          ? input.kiddingEase
          : kidding.kiddingEase,
        input.notes ?? null,
        now,
        kiddingId,
      ],
    );

    await syncKiddingLitterAnimals(tx, kidding, input, damLabel);
  });
}

export type KiddingKidSummary = {
  id: string;
  name: string | null;
  tagNumber: string | null;
  hasWeights: boolean;
  hasHealth: boolean;
};

export async function getKidsForKidding(
  kiddingId: string,
): Promise<KiddingKidSummary[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT a.id, a.name, a.tag_number,
      (SELECT COUNT(*) FROM weight_logs wl WHERE wl.animal_id = a.id) as weight_count,
      (SELECT COUNT(*) FROM health_records hr WHERE hr.animal_id = a.id) as health_count
     FROM animals a
     WHERE a.litter_id = ?`,
    [kiddingId],
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: row.name != null ? String(row.name) : null,
    tagNumber: row.tag_number != null ? String(row.tag_number) : null,
    hasWeights: Number(row.weight_count) > 0,
    hasHealth: Number(row.health_count) > 0,
  }));
}

export async function deleteKiddingEvent(
  kiddingId: string,
  options: { deleteRegisteredKids: boolean },
): Promise<void> {
  const now = dbNow();

  await powersync.writeTransaction(async (tx: Transaction) => {
    const breeding = await tx.getOptional<Record<string, unknown>>(
      'SELECT id FROM breeding_events WHERE kidding_event_id = ?',
      [kiddingId],
    );

    if (options.deleteRegisteredKids) {
      const kids = await tx.getAll<{ id: string }>(
        'SELECT id FROM animals WHERE litter_id = ?',
        [kiddingId],
      );
      for (const kid of kids) {
        await tx.execute('DELETE FROM animals WHERE id = ?', [kid.id]);
      }
    }

    await tx.execute(
      `DELETE FROM tasks
       WHERE source = 'weaning' AND source_id = ? AND completed = 0`,
      [kiddingId],
    );
    await tx.execute('DELETE FROM kidding_events WHERE id = ?', [kiddingId]);

    if (breeding) {
      await tx.execute(
        `UPDATE breeding_events
         SET status = 'bred', kidding_event_id = NULL, updated_at = ?
         WHERE id = ?`,
        [now, String(breeding.id)],
      );
    }
  });
}
