import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { getAnimalById } from '@/lib/db/animals';
import { dbNow } from '@/lib/db/now';
import { mapBreedingEvent, mapKiddingEvent } from '@/lib/db/mappers';
import {
  expectedKiddingTaskTitle,
  isBreedingOpenForKidding,
  kidAnimalDefaultName,
  targetRegisteredKidCount,
} from '@/lib/domain/breeding';
import { addDaysToIso, GOAT_GESTATION_DAYS } from '@/lib/dates';
import { ORDER_DUE_DATE_DESC } from '@/lib/sql/portableOrder';
import { powersync } from '@/lib/powersync/system';
import type { BreedingEvent, BreedingStatus, KiddingEvent } from '@/lib/types/breeding';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';

async function syncOpenBreedingDueTask(
  tx: Transaction,
  farmId: string,
  breedingId: string,
  input: {
    dueDate: string;
    damLabel: string;
    status: BreedingStatus;
  },
): Promise<void> {
  if (!isBreedingOpenForKidding(input.status) || !input.dueDate) {
    return;
  }

  const now = dbNow();
  const title = expectedKiddingTaskTitle(input.damLabel);
  const openTask = await tx.getOptional<{ id: string }>(
    `SELECT id FROM tasks
     WHERE source_id = ? AND source = 'breeding' AND completed = 0
     LIMIT 1`,
    [breedingId],
  );

  if (openTask) {
    await tx.execute(
      'UPDATE tasks SET title = ?, due_date = ?, updated_at = ? WHERE id = ?',
      [title, input.dueDate, now, openTask.id],
    );
    return;
  }

  const id = Crypto.randomUUID();
  await tx.execute(
    `INSERT INTO tasks (
      id, farm_id, title, due_date, priority, source, source_id, completed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'high', 'breeding', ?, 0, ?, ?)`,
    [id, farmId, title, input.dueDate, breedingId, now, now],
  );
}

export async function createBreedingEvent(
  farmId: string,
  input: {
    damId: string;
    sireId?: string;
    sireExternalName?: string;
    bredDate: string;
    dueDate?: string;
    status?: BreedingStatus;
    notes?: string;
    damLabel?: string;
    scheduleDueTask?: boolean;
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = dbNow();
  const dueDate =
    input.dueDate ??
    addDaysToIso(input.bredDate, GOAT_GESTATION_DAYS) ??
    null;

  const scheduleTask =
    input.scheduleDueTask !== false && dueDate != null && input.damLabel;

  if (scheduleTask) {
    await powersync.writeTransaction(async (tx: Transaction) => {
      await tx.execute(
        `INSERT INTO breeding_events (
          id, farm_id, dam_id, sire_id, sire_external_name,
          bred_date, due_date, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          farmId,
          input.damId,
          input.sireId ?? null,
          input.sireExternalName ?? null,
          input.bredDate,
          dueDate,
          input.status ?? 'bred',
          input.notes ?? null,
          now,
          now,
        ],
      );
      await syncOpenBreedingDueTask(tx, farmId, id, {
        dueDate,
        damLabel: input.damLabel!,
        status: input.status ?? 'bred',
      });
    });
  } else {
    await powersync.execute(
      `INSERT INTO breeding_events (
        id, farm_id, dam_id, sire_id, sire_external_name,
        bred_date, due_date, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        farmId,
        input.damId,
        input.sireId ?? null,
        input.sireExternalName ?? null,
        input.bredDate,
        dueDate,
        input.status ?? 'bred',
        input.notes ?? null,
        now,
        now,
      ],
    );
  }

  return id;
}

export type KiddingKidDraft = {
  name?: string;
  tagNumber?: string;
  sex: 'male' | 'female';
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
    registerKids?: KiddingKidDraft[];
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = dbNow();
  const damLabel = input.damLabel ?? 'Dam';

  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `INSERT INTO kidding_events (
        id, farm_id, dam_id, sire_id, sire_external_name,
        kid_date, kids_born, kids_surviving, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        farmId,
        input.damId,
        input.sireId ?? null,
        input.sireExternalName ?? null,
        input.kidDate,
        input.kidsBorn,
        input.kidsSurviving ?? null,
        input.notes ?? null,
        now,
        now,
      ],
    );

    const openBreeding = await tx.getOptional<Record<string, unknown>>(
      `SELECT id, status FROM breeding_events
       WHERE farm_id = ? AND dam_id = ? AND kidding_event_id IS NULL
       ORDER BY bred_date DESC
       LIMIT 1`,
      [farmId, input.damId],
    );

    if (
      openBreeding &&
      isBreedingOpenForKidding(String(openBreeding.status) as BreedingStatus)
    ) {
      await tx.execute(
        `UPDATE breeding_events
         SET status = 'kidded', kidding_event_id = ?, updated_at = ?
         WHERE id = ?`,
        [id, now, String(openBreeding.id)],
      );
    }

    const kids = input.registerKids ?? [];
    for (let i = 0; i < kids.length; i++) {
      const kid = kids[i];
      const kidId = Crypto.randomUUID();
      await tx.execute(
        `INSERT INTO animals (
          id, farm_id, name, tag_number, sex, status, lifecycle_stage,
          purpose, breed_primary_id, date_of_birth, dam_id, sire_id,
          sire_external_name, litter_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'active', 'kid', NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [
          kidId,
          farmId,
          kid.name ?? kidAnimalDefaultName(damLabel, i + 1),
          kid.tagNumber ?? null,
          kid.sex,
          input.kidDate,
          input.damId,
          input.sireId ?? null,
          input.sireExternalName ?? null,
          id,
          now,
          now,
        ],
      );
    }
  });

  return id;
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
    notes?: string;
    damLabel?: string;
    status?: BreedingStatus;
  },
): Promise<void> {
  const existing = await getBreedingEventById(breedingId);
  const status = input.status ?? existing?.status ?? 'bred';
  const now = dbNow();
  const dueDate =
    addDaysToIso(input.bredDate, GOAT_GESTATION_DAYS) ?? null;
  const damLabel = input.damLabel ?? 'Dam';
  const farmId = existing?.farmId;

  await powersync.writeTransaction(async (tx: Transaction) => {
    await tx.execute(
      `UPDATE breeding_events SET
        dam_id = ?, sire_id = ?, sire_external_name = ?,
        bred_date = ?, due_date = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.damId,
        input.sireId ?? null,
        input.sireExternalName ?? null,
        input.bredDate,
        dueDate,
        input.notes ?? null,
        now,
        breedingId,
      ],
    );

    if (farmId && dueDate) {
      await syncOpenBreedingDueTask(tx, farmId, breedingId, {
        dueDate,
        damLabel,
        status,
      });
    }
  });
}

/** Creates or updates the open expected-kidding task when breeding is still active. */
export async function ensureBreedingDueTask(breedingId: string): Promise<void> {
  const breeding = await getBreedingEventById(breedingId);
  if (!breeding?.dueDate) {
    return;
  }

  const dam = await getAnimalById(breeding.damId);
  const damLabel = dam ? animalDisplayLabel(dam) : 'Dam';

  await powersync.writeTransaction(async (tx: Transaction) => {
    await syncOpenBreedingDueTask(tx, breeding.farmId, breedingId, {
      dueDate: breeding.dueDate!,
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
        sire_id = ?, sire_external_name = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.kidDate,
        input.kidsBorn,
        input.kidsSurviving ?? null,
        input.sireId ?? null,
        input.sireExternalName ?? null,
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
