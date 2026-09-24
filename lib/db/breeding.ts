import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { mapBreedingEvent, mapKiddingEvent } from '@/lib/db/mappers';
import {
  expectedKiddingTaskTitle,
  isBreedingOpenForKidding,
  kidAnimalDefaultName,
} from '@/lib/domain/breeding';
import { addDaysToIso, GOAT_GESTATION_DAYS } from '@/lib/dates';
import { ORDER_DUE_DATE_DESC } from '@/lib/sql/portableOrder';
import { powersync } from '@/lib/powersync/system';
import type { BreedingEvent, BreedingStatus, KiddingEvent } from '@/lib/types/breeding';

async function insertBreedingDueTask(
  tx: Transaction,
  farmId: string,
  breedingId: string,
  dueDate: string,
  damLabel: string,
): Promise<void> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await tx.execute(
    `INSERT INTO tasks (
      id, farm_id, title, due_date, priority, source, source_id, completed, created_at
    ) VALUES (?, ?, ?, ?, 'high', 'breeding', ?, 0, ?)`,
    [id, farmId, expectedKiddingTaskTitle(damLabel), dueDate, breedingId, now],
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
  const now = new Date().toISOString();
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
      await insertBreedingDueTask(
        tx,
        farmId,
        id,
        dueDate,
        input.damLabel!,
      );
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
  const now = new Date().toISOString();
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
