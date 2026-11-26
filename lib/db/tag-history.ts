import * as Crypto from 'expo-crypto';

import type { Transaction } from '@powersync/common';

import { todayIso } from '@/lib/dates';
import {
  currentTagDuplicateMessage,
  normalizeTagValue,
  planTagChange,
  TAG_KIND_COLUMN,
  TAG_KINDS,
  tagHistoryTableReady,
  tagValuesMatch,
  type CurrentTagHolder,
  type TagChangeAction,
  type TagChangePlan,
  type TagKind,
} from '@/lib/domain/tag-history';
import { powersync } from '@/lib/powersync/system';
import { supabase } from '@/lib/supabase/client';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';

import { assertFarmWriteAllowed } from '@/lib/db/farm-write-guard';
import { dbNow } from '@/lib/db/now';

type Sql = Pick<Transaction, 'execute' | 'getOptional' | 'getAll'>;

export type AnimalTagFields = {
  tagNumber: string | null;
  officialId: string | null;
  tattoo: string | null;
};

export async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export const TAG_HISTORY_UNAVAILABLE =
  'Tag history is not on this phone yet. Wait for the herd to finish syncing, then try again.';

function fieldValue(fields: AnimalTagFields, kind: TagKind): string | null {
  switch (kind) {
    case 'farm_tag':
      return fields.tagNumber;
    case 'official_id':
      return fields.officialId;
    case 'tattoo':
      return fields.tattoo;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function actionForChange(
  previous: string | null,
  next: string | null,
): TagChangeAction | null {
  const prev = normalizeTagValue(previous);
  const nxt = normalizeTagValue(next);
  if (prev === nxt) {
    return null;
  }
  if (prev && nxt && tagValuesMatch(prev, nxt)) {
    return 'replace';
  }
  if (!prev && nxt) {
    return 'add';
  }
  if (prev && !nxt) {
    return 'clear';
  }
  if (prev && nxt) {
    return 'replace';
  }
  return null;
}

async function loadHolders(
  db: Sql,
  farmId: string,
  kind: TagKind,
  excludeAnimalId: string,
): Promise<CurrentTagHolder[]> {
  const column = TAG_KIND_COLUMN[kind];
  const rows = await db.getAll<Record<string, unknown>>(
    `SELECT id, name, tag_number, official_id
     FROM animals
     WHERE farm_id = ? AND id != ? AND ${column} IS NOT NULL`,
    [farmId, excludeAnimalId],
  );
  const holders: CurrentTagHolder[] = [];
  for (const row of rows) {
    const value = normalizeTagValue(
      row[column] != null ? String(row[column]) : null,
    );
    if (!value) {
      continue;
    }
    holders.push({
      animalId: String(row.id),
      value,
      label: animalDisplayLabel({
        name: row.name != null ? String(row.name) : null,
        tagNumber: row.tag_number != null ? String(row.tag_number) : null,
        officialId: row.official_id != null ? String(row.official_id) : null,
      }),
    });
  }

  if (!(await tagHistoryTableReady(db))) {
    return holders;
  }

  const historyRows = await db.getAll<Record<string, unknown>>(
    `SELECT h.animal_id, h.value, a.name, a.tag_number, a.official_id
     FROM tag_history h
     JOIN animals a ON a.id = h.animal_id
     WHERE h.farm_id = ? AND h.kind = ? AND h.ended_on IS NULL AND h.animal_id != ?`,
    [farmId, kind, excludeAnimalId],
  );
  for (const row of historyRows) {
    const value = normalizeTagValue(
      row.value != null ? String(row.value) : null,
    );
    if (!value) {
      continue;
    }
    const animalId = String(row.animal_id);
    if (holders.some((holder) => holder.animalId === animalId && tagValuesMatch(holder.value, value))) {
      continue;
    }
    holders.push({
      animalId,
      value,
      label: animalDisplayLabel({
        name: row.name != null ? String(row.name) : null,
        tagNumber: row.tag_number != null ? String(row.tag_number) : null,
        officialId: row.official_id != null ? String(row.official_id) : null,
      }),
    });
  }
  return holders;
}

async function openHistoryId(
  db: Sql,
  animalId: string,
  kind: TagKind,
): Promise<string | null> {
  if (!(await tagHistoryTableReady(db))) {
    return null;
  }
  const row = await db.getOptional<{ id: string }>(
    `SELECT id FROM tag_history
     WHERE animal_id = ? AND kind = ? AND ended_on IS NULL
     LIMIT 1`,
    [animalId, kind],
  );
  return row?.id ?? null;
}

async function writePlan(
  db: Sql,
  plan: Extract<TagChangePlan, { ok: true }>,
  input: {
    farmId: string;
    animalId: string;
    createdBy: string | null;
    today: string;
  },
): Promise<void> {
  const now = dbNow();
  if (plan.closeOpenId) {
    await db.execute(
      `UPDATE tag_history SET ended_on = ?, note = COALESCE(?, note) WHERE id = ?`,
      [input.today, plan.closeNote, plan.closeOpenId],
    );
  }
  if (plan.reviseOpenId && plan.reviseValue) {
    await db.execute(`UPDATE tag_history SET value = ? WHERE id = ?`, [
      plan.reviseValue,
      plan.reviseOpenId,
    ]);
  }
  if (plan.insertOpen) {
    await db.execute(
      `INSERT INTO tag_history (
        id, farm_id, animal_id, kind, value, started_on, ended_on, note, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        Crypto.randomUUID(),
        input.farmId,
        input.animalId,
        plan.kind,
        plan.insertOpen.value,
        plan.insertOpen.startedOn,
        plan.insertOpen.note,
        now,
        input.createdBy,
      ],
    );
  }
}

async function planAgainstHerd(
  db: Sql,
  input: {
    action: TagChangeAction;
    kind: TagKind;
    animalId: string;
    farmId: string;
    currentValue: string | null;
    nextValue: string | null;
    note: string | null;
    today: string;
  },
): Promise<TagChangePlan> {
  const holders = await loadHolders(db, input.farmId, input.kind, input.animalId);
  const openId = await openHistoryId(db, input.animalId, input.kind);
  return planTagChange({
    action: input.action,
    kind: input.kind,
    currentValue: input.currentValue,
    nextValue: input.nextValue,
    note: input.note,
    today: input.today,
    openHistoryId: openId,
    holders,
    animalId: input.animalId,
  });
}

export async function syncChangedTagsInTx(
  db: Sql,
  input: {
    farmId: string;
    animalId: string;
    createdBy: string | null;
    today: string;
    previous: AnimalTagFields;
    next: AnimalTagFields;
  },
): Promise<void> {
  const changes: { kind: TagKind; action: TagChangeAction; next: string | null }[] = [];
  for (const kind of TAG_KINDS) {
    const action = actionForChange(fieldValue(input.previous, kind), fieldValue(input.next, kind));
    if (!action) {
      continue;
    }
    changes.push({
      kind,
      action,
      next: fieldValue(input.next, kind),
    });
  }
  if (changes.length === 0) {
    return;
  }
  if (!(await tagHistoryTableReady(db))) {
    throw new Error(TAG_HISTORY_UNAVAILABLE);
  }
  for (const change of changes) {
    const plan = await planAgainstHerd(db, {
      action: change.action,
      kind: change.kind,
      animalId: input.animalId,
      farmId: input.farmId,
      currentValue: fieldValue(input.previous, change.kind),
      nextValue: change.next,
      note: null,
      today: input.today,
    });
    if (!plan.ok) {
      throw new Error(plan.message);
    }
    await writePlan(db, plan, input);
  }
}

export async function recordInitialTagsInTx(
  db: Sql,
  input: {
    farmId: string;
    animalId: string;
    createdBy: string | null;
    today: string;
    tags: AnimalTagFields;
  },
): Promise<void> {
  const nonempty = TAG_KINDS.filter((kind) => normalizeTagValue(fieldValue(input.tags, kind)));
  if (nonempty.length === 0) {
    return;
  }
  if (!(await tagHistoryTableReady(db))) {
    for (const kind of nonempty) {
      const holders = await loadHolders(db, input.farmId, kind, input.animalId);
      const plan = planTagChange({
        action: 'add',
        kind,
        currentValue: null,
        nextValue: fieldValue(input.tags, kind),
        note: null,
        today: input.today,
        openHistoryId: null,
        holders,
        animalId: input.animalId,
      });
      if (!plan.ok) {
        throw new Error(plan.message);
      }
    }
    return;
  }
  for (const kind of nonempty) {
    const plan = await planAgainstHerd(db, {
      action: 'add',
      kind,
      animalId: input.animalId,
      farmId: input.farmId,
      currentValue: null,
      nextValue: fieldValue(input.tags, kind),
      note: null,
      today: input.today,
    });
    if (!plan.ok) {
      throw new Error(plan.message);
    }
    await writePlan(db, plan, input);
  }
}

export async function deleteAnimalTagHistoryInTx(
  db: Sql,
  animalId: string,
): Promise<void> {
  if (!(await tagHistoryTableReady(db))) {
    return;
  }
  await db.execute('DELETE FROM tag_history WHERE animal_id = ?', [animalId]);
}

export async function changeAnimalTag(
  animalId: string,
  input: {
    action: TagChangeAction;
    kind: TagKind;
    value?: string | null;
    note?: string | null;
  },
): Promise<void> {
  const createdBy = await currentUserId();
  const today = todayIso();
  const animalFarm = await powersync.getOptional<{ farm_id: string }>(
    'SELECT farm_id FROM animals WHERE id = ?',
    [animalId],
  );
  if (!animalFarm?.farm_id) {
    throw new Error('Animal not found.');
  }
  await assertFarmWriteAllowed(String(animalFarm.farm_id));
  await powersync.writeTransaction(async (tx) => {
    if (!(await tagHistoryTableReady(tx))) {
      throw new Error(TAG_HISTORY_UNAVAILABLE);
    }
    const row = await tx.getOptional<Record<string, unknown>>(
      'SELECT * FROM animals WHERE id = ?',
      [animalId],
    );
    if (!row) {
      throw new Error('Animal not found.');
    }
    const fields: AnimalTagFields = {
      tagNumber: row.tag_number != null ? String(row.tag_number) : null,
      officialId: row.official_id != null ? String(row.official_id) : null,
      tattoo: row.tattoo != null ? String(row.tattoo) : null,
    };
    const plan = await planAgainstHerd(tx, {
      action: input.action,
      kind: input.kind,
      animalId,
      farmId: String(row.farm_id),
      currentValue: fieldValue(fields, input.kind),
      nextValue: input.value ?? null,
      note: input.note ?? null,
      today,
    });
    if (!plan.ok) {
      throw new Error(plan.message);
    }
    await writePlan(tx, plan, {
      farmId: String(row.farm_id),
      animalId,
      createdBy,
      today,
    });
    await tx.execute(
      `UPDATE animals SET ${plan.column} = ?, updated_at = ? WHERE id = ?`,
      [plan.nextValue, dbNow(), animalId],
    );
  });
}

export async function describeCurrentTagConflict(
  farmId: string,
  tags: AnimalTagFields,
  excludeAnimalId?: string,
): Promise<string | null> {
  for (const kind of TAG_KINDS) {
    const value = normalizeTagValue(fieldValue(tags, kind));
    if (!value) {
      continue;
    }
    const column = TAG_KIND_COLUMN[kind];
    const row = await powersync.getOptional<Record<string, unknown>>(
      `SELECT id, name, tag_number, official_id FROM animals
       WHERE farm_id = ?
         AND (? IS NULL OR id != ?)
         AND lower(trim(${column})) = lower(?)
       LIMIT 1`,
      [farmId, excludeAnimalId ?? null, excludeAnimalId ?? null, value],
    );
    if (!row) {
      continue;
    }
    return currentTagDuplicateMessage(
      kind,
      value,
      animalDisplayLabel({
        name: row.name != null ? String(row.name) : null,
        tagNumber: row.tag_number != null ? String(row.tag_number) : null,
        officialId: row.official_id != null ? String(row.official_id) : null,
      }),
    );
  }
  return null;
}

export function tagsFromAnimalColumns(row: {
  tagNumber?: string | null;
  officialId?: string | null;
  tattoo?: string | null;
}): AnimalTagFields {
  return {
    tagNumber: row.tagNumber ?? null,
    officialId: row.officialId ?? null,
    tattoo: row.tattoo ?? null,
  };
}
