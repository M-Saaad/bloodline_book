import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { dbNow } from '@/lib/db/now';
import { currentUserId } from '@/lib/db/tag-history';
import {
  applyFastKidding,
  markDoeOpenThisSeason,
  prepareFastKidding,
  undoFastKidding,
  type FastKidDraft,
  type FastKiddingResult,
} from '@/lib/domain/fast-kidding';
import { assertFarmWriteAllowed, assertFarmWriteAllowedForKidding } from '@/lib/db/farm-write-guard';
import { powersync } from '@/lib/powersync/system';

export async function saveFastKidding(
  farmId: string,
  input: {
    damId: string;
    kidDate: string;
    kids: readonly FastKidDraft[];
    breedingEventId?: string | null;
    weaningDays?: number | null;
    weightUnit: 'lb' | 'kg';
    damLabel: string;
  },
): Promise<FastKiddingResult> {
  const prepared = prepareFastKidding({
    damId: input.damId,
    kidDate: input.kidDate,
    kids: input.kids,
  });
  if (!prepared.ok) {
    throw new Error(prepared.message);
  }

  await assertFarmWriteAllowed(farmId);

  const createdBy = await currentUserId();
  const now = dbNow();

  return powersync.writeTransaction((tx: Transaction) =>
    applyFastKidding(tx, {
      farmId,
      damId: input.damId,
      kidDate: input.kidDate,
      kids: prepared.kids,
      breedingEventId: input.breedingEventId,
      weaningDays: input.weaningDays,
      weightUnit: input.weightUnit,
      damLabel: input.damLabel,
      createdBy,
      now,
      newId: () => Crypto.randomUUID(),
    }),
  );
}

export async function undoSavedFastKidding(kiddingId: string): Promise<void> {
  await assertFarmWriteAllowedForKidding(kiddingId);
  const now = dbNow();
  await powersync.writeTransaction(async (tx: Transaction) => {
    await undoFastKidding(tx, { kiddingId, now });
  });
}

export async function markDoeOpenForSeason(
  farmId: string,
  animalId: string,
  seasonStart: string,
): Promise<void> {
  await assertFarmWriteAllowed(farmId);
  const createdBy = await currentUserId();
  const now = dbNow();
  await powersync.writeTransaction(async (tx: Transaction) => {
    await markDoeOpenThisSeason(tx, {
      farmId,
      animalId,
      seasonStart,
      createdBy,
      now,
      newId: () => Crypto.randomUUID(),
    });
  });
}
