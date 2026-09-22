import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { mapFeedLog, mapGrazingRecord, mapPasture } from '@/lib/db/mappers';
import {
  pastureStatusAfterLastMoveOut,
  pastureStatusAfterMoveIn,
} from '@/lib/domain/land';
import { powersync } from '@/lib/powersync/system';
import type {
  FeedLog,
  FeedUnit,
  ForageType,
  GrazingRecord,
  Pasture,
  PastureStatus,
} from '@/lib/types/land';

export async function createPasture(
  farmId: string,
  input: {
    name: string;
    acres?: number;
    forageType: ForageType;
    status?: PastureStatus;
    notes?: string;
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO pastures (
      id, farm_id, name, acres, forage_type, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      farmId,
      input.name,
      input.acres ?? null,
      input.forageType,
      input.status ?? 'resting',
      input.notes ?? null,
      now,
      now,
    ],
  );

  return id;
}

export async function updatePastureStatus(
  pastureId: string,
  status: PastureStatus,
): Promise<void> {
  const now = new Date().toISOString();
  await powersync.execute(
    'UPDATE pastures SET status = ?, updated_at = ? WHERE id = ?',
    [status, now, pastureId],
  );
}

export async function getPasturesForFarm(farmId: string): Promise<Pasture[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM pastures
     WHERE farm_id = ?
     ORDER BY name COLLATE NOCASE`,
    [farmId],
  );
  return rows.map(mapPasture);
}

export async function moveAnimalsToPasture(
  farmId: string,
  input: {
    pastureId: string;
    animalIds: string[];
    startDate: string;
    notes?: string;
  },
): Promise<void> {
  if (input.animalIds.length === 0) {
    return;
  }

  const now = new Date().toISOString();

  await powersync.writeTransaction(async (tx: Transaction) => {
    const previousPastureIds = new Set<string>();

    for (const animalId of input.animalIds) {
      const openRows = await tx.getAll<Record<string, unknown>>(
        `SELECT id, pasture_id FROM grazing_records
         WHERE animal_id = ? AND end_date IS NULL`,
        [animalId],
      );

      for (const row of openRows) {
        const openId = String(row.id);
        const previousPastureId = String(row.pasture_id);
        previousPastureIds.add(previousPastureId);
        await tx.execute(
          'UPDATE grazing_records SET end_date = ? WHERE id = ?',
          [input.startDate, openId],
        );
      }

      const alreadyOnTarget = openRows.some(
        (row) => String(row.pasture_id) === input.pastureId,
      );
      if (alreadyOnTarget) {
        continue;
      }

      const recordId = Crypto.randomUUID();
      await tx.execute(
        `INSERT INTO grazing_records (
          id, farm_id, pasture_id, animal_id, start_date, end_date, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          recordId,
          farmId,
          input.pastureId,
          animalId,
          input.startDate,
          input.notes ?? null,
          now,
        ],
      );
    }

    const destination = await tx.getOptional<Record<string, unknown>>(
      'SELECT status FROM pastures WHERE id = ?',
      [input.pastureId],
    );
    if (destination) {
      const nextStatus = pastureStatusAfterMoveIn(
        destination.status as PastureStatus,
      );
      if (nextStatus !== destination.status) {
        await tx.execute(
          'UPDATE pastures SET status = ?, updated_at = ? WHERE id = ?',
          [nextStatus, now, input.pastureId],
        );
      }
    }

    for (const previousPastureId of previousPastureIds) {
      if (previousPastureId === input.pastureId) {
        continue;
      }
      await maybeRestPasture(tx, previousPastureId, now);
    }
  });
}

export async function endGrazingRecords(
  recordIds: string[],
  endDate: string,
): Promise<void> {
  if (recordIds.length === 0) {
    return;
  }

  const now = new Date().toISOString();

  await powersync.writeTransaction(async (tx: Transaction) => {
    const pastureIds = new Set<string>();
    for (const recordId of recordIds) {
      const row = await tx.getOptional<Record<string, unknown>>(
        'SELECT pasture_id FROM grazing_records WHERE id = ?',
        [recordId],
      );
      if (!row) {
        continue;
      }
      pastureIds.add(String(row.pasture_id));
      await tx.execute(
        'UPDATE grazing_records SET end_date = ? WHERE id = ? AND end_date IS NULL',
        [endDate, recordId],
      );
    }

    for (const pastureId of pastureIds) {
      await maybeRestPasture(tx, pastureId, now);
    }
  });
}

async function maybeRestPasture(
  tx: Transaction,
  pastureId: string,
  now: string,
): Promise<void> {
  const remaining = await tx.getOptional<{ count: number }>(
    `SELECT COUNT(*) as count FROM grazing_records
     WHERE pasture_id = ? AND end_date IS NULL`,
    [pastureId],
  );
  if (Number(remaining?.count ?? 0) > 0) {
    return;
  }

  const pasture = await tx.getOptional<Record<string, unknown>>(
    'SELECT status FROM pastures WHERE id = ?',
    [pastureId],
  );
  if (!pasture) {
    return;
  }

  const nextStatus = pastureStatusAfterLastMoveOut(
    pasture.status as PastureStatus,
  );
  if (nextStatus !== pasture.status) {
    await tx.execute(
      'UPDATE pastures SET status = ?, updated_at = ? WHERE id = ?',
      [nextStatus, now, pastureId],
    );
  }
}

export async function createFeedLog(
  farmId: string,
  input: {
    date: string;
    feedType: string;
    quantity?: number;
    unit: FeedUnit;
    pastureId?: string;
    notes?: string;
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO feed_logs (
      id, farm_id, date, feed_type, quantity, unit, pasture_id, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      farmId,
      input.date,
      input.feedType,
      input.quantity ?? null,
      input.unit,
      input.pastureId ?? null,
      input.notes ?? null,
      now,
    ],
  );

  return id;
}

export async function getFeedLogsForFarm(farmId: string): Promise<FeedLog[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM feed_logs
     WHERE farm_id = ?
     ORDER BY date DESC, created_at DESC`,
    [farmId],
  );
  return rows.map(mapFeedLog);
}

export async function getOpenGrazingForFarm(
  farmId: string,
): Promise<GrazingRecord[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM grazing_records
     WHERE farm_id = ? AND end_date IS NULL
     ORDER BY start_date DESC`,
    [farmId],
  );
  return rows.map(mapGrazingRecord);
}
