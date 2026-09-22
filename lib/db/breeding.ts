import * as Crypto from 'expo-crypto';

import { mapBreedingEvent, mapKiddingEvent } from '@/lib/db/mappers';
import { addDaysToIso, GOAT_GESTATION_DAYS } from '@/lib/dates';
import { powersync } from '@/lib/powersync/system';
import type { BreedingEvent, BreedingStatus, KiddingEvent } from '@/lib/types/breeding';

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
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const dueDate =
    input.dueDate ??
    addDaysToIso(input.bredDate, GOAT_GESTATION_DAYS) ??
    null;

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

  return id;
}

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
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.execute(
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

  return id;
}

export async function getBreedingEventsForFarm(
  farmId: string,
): Promise<BreedingEvent[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM breeding_events
     WHERE farm_id = ?
     ORDER BY due_date DESC NULLS LAST, bred_date DESC`,
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
