import { addDaysToIso, formatIsoDate, parseIsoDate } from '@/lib/dates';
import { parseBirthOrder } from '@/lib/domain/animals';
import { isBreedingOpenForKidding } from '@/lib/domain/breeding';
import { kidInheritsBreed, parseBirthWeight, weaningTaskTitle } from '@/lib/domain/kidding';
import {
  currentTagDuplicateMessage,
  normalizeTagValue,
  planTagChange,
  tagHistoryTableReady,
  type CurrentTagHolder,
} from '@/lib/domain/tag-history';
import type { Animal } from '@/lib/types/animals';
import type { BreedingStatus } from '@/lib/types/breeding';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';

/** How long the kidding confirmation keeps Undo. */
export const FAST_KIDDING_UNDO_MS = 8000;

export const KIDDING_SEASON_MARKS_UNAVAILABLE =
  'Marking a doe open is not on this phone yet. Wait for the herd to finish syncing, then try again.';

export const FAST_KIDDING_TAG_HISTORY_UNAVAILABLE =
  'Tag history is not on this phone yet. Wait for the herd to finish syncing, then try again.';

/**
 * PowerSync stores synced rows in `ps_data__kidding_season_marks` and exposes
 * `kidding_season_marks` as a view. A plain SQLite table of the same name also counts.
 */
export const KIDDING_SEASON_MARKS_READY_SQL =
  "SELECT name FROM sqlite_master WHERE name = 'kidding_season_marks' AND type IN ('table', 'view')";

const ELIGIBLE_LIFECYCLE = new Set(['breeding', 'adult']);

export type Sql = {
  execute(query: string, parameters?: any[]): Promise<any>;
  getOptional<T>(query: string, parameters?: any[]): Promise<T | null>;
  getAll<T>(query: string, parameters?: any[]): Promise<T[]>;
};

export type FastKidSex = 'male' | 'female';
export type FastKidOutcome = 'alive' | 'dead';

export type FastKidDraft = {
  sex: FastKidSex | null;
  outcome: FastKidOutcome;
  color: string;
  birthWeight: string;
  tagNumber: string;
  birthOrder: string;
};

export type PreparedKid = {
  sex: FastKidSex;
  outcome: FastKidOutcome;
  color: string | null;
  birthWeight: number | null;
  tagNumber: string | null;
  birthOrder: number;
};

export type FastKiddingResult = {
  kiddingId: string;
  kidIds: string[];
  kids: PreparedKid[];
};

type DoeFields = {
  id: string;
  sex: string;
  status: string;
  lifecycleStage: string;
};

/**
 * 1 December of the season that contains today.
 * December uses this calendar year. January through November use last year's
 * 1 December, which is the start of the season that included this January.
 */
export function defaultKiddingSeasonStart(today: string): string {
  if (!parseIsoDate(today)) {
    throw new Error('Enter a valid date.');
  }
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const startYear = month >= 12 ? year : year - 1;
  return `${startYear}-12-01`;
}

export function resolveKiddingSeasonStart(
  stored: string | null | undefined,
  today: string,
): string {
  const trimmed = stored?.trim() ?? '';
  if (parseIsoDate(trimmed)) {
    return trimmed;
  }
  return defaultKiddingSeasonStart(today);
}

export function kiddingSeasonEnd(seasonStart: string): string {
  const parsed = parseIsoDate(seasonStart);
  if (!parsed) {
    throw new Error('Enter a valid kidding season start.');
  }
  parsed.setFullYear(parsed.getFullYear() + 1);
  return formatIsoDate(parsed);
}

export function notKiddedYet<T extends DoeFields>(
  animals: readonly T[],
  kiddings: readonly { damId: string; kidDate: string }[],
  marks: readonly { animalId: string; seasonStart: string }[],
  seasonStart: string,
): T[] {
  const end = kiddingSeasonEnd(seasonStart);
  const kidded = new Set(
    kiddings
      .filter((row) => row.kidDate >= seasonStart && row.kidDate < end)
      .map((row) => row.damId),
  );
  const opened = new Set(
    marks
      .filter((row) => row.seasonStart === seasonStart)
      .map((row) => row.animalId),
  );
  return animals.filter(
    (animal) =>
      animal.sex === 'female' &&
      animal.status === 'active' &&
      ELIGIBLE_LIFECYCLE.has(animal.lifecycleStage) &&
      !kidded.has(animal.id) &&
      !opened.has(animal.id),
  );
}

export function notKiddedYetLabel(count: number): string {
  if (count === 1) {
    return '1 doe not kidded yet';
  }
  return `${count} does not kidded yet`;
}

export function prepareFastKidding(input: {
  damId: string | null;
  kidDate: string;
  kids: readonly FastKidDraft[];
}): { ok: true; kids: PreparedKid[] } | { ok: false; message: string } {
  if (!input.damId) {
    return { ok: false, message: 'Choose the doe.' };
  }
  if (!parseIsoDate(input.kidDate)) {
    return { ok: false, message: 'Enter the kidding date.' };
  }
  if (input.kids.length < 1) {
    return { ok: false, message: 'Add at least one kid.' };
  }

  const kids: PreparedKid[] = [];
  for (let index = 0; index < input.kids.length; index += 1) {
    const kid = input.kids[index];
    if (kid.sex !== 'male' && kid.sex !== 'female') {
      return { ok: false, message: 'Choose buck or doe for each kid.' };
    }
    if (kid.outcome !== 'alive' && kid.outcome !== 'dead') {
      return { ok: false, message: 'Choose alive or stillborn for each kid.' };
    }
    const weight = parseBirthWeight(kid.birthWeight);
    if (weight === 'invalid') {
      return {
        ok: false,
        message: 'Enter a valid birth weight or leave it blank.',
      };
    }
    const orderText = kid.birthOrder.trim();
    const parsedOrder = orderText
      ? parseBirthOrder(orderText)
      : { value: index + 1, error: null };
    if (parsedOrder.error || parsedOrder.value == null) {
      return {
        ok: false,
        message: parsedOrder.error ?? 'Enter a birth order.',
      };
    }
    const color = kid.color.trim();
    kids.push({
      sex: kid.sex,
      outcome: kid.outcome,
      color: color ? color : null,
      birthWeight: weight,
      tagNumber: normalizeTagValue(kid.tagNumber),
      birthOrder: parsedOrder.value,
    });
  }

  return { ok: true, kids };
}

export function fastKidConfirmationLine(kid: PreparedKid): string {
  const sex = kid.sex === 'male' ? 'Buck' : 'Doe';
  const tag = kid.tagNumber ? ` #${kid.tagNumber}` : '';
  const color = kid.color ? `, ${kid.color}` : '';
  const life = kid.outcome === 'dead' ? 'stillborn' : 'alive';
  return `${kid.birthOrder}. ${sex}${tag}${color}, ${life}`;
}

export async function loadSeasonMarks(
  db: Sql,
  farmId: string,
  seasonStart: string,
): Promise<{ animalId: string; seasonStart: string }[]> {
  if (!(await kiddingSeasonMarksReady(db))) {
    return [];
  }
  const rows = await db.getAll<{ animal_id: string; season_start: string }>(
    `SELECT animal_id, season_start FROM kidding_season_marks
     WHERE farm_id = ? AND season_start = ?`,
    [farmId, seasonStart],
  );
  return rows.map((row) => ({
    animalId: String(row.animal_id),
    seasonStart: String(row.season_start).slice(0, 10),
  }));
}

export async function kiddingSeasonMarksReady(db: Sql): Promise<boolean> {
  try {
    const row = await db.getOptional<{ name: string }>(
      KIDDING_SEASON_MARKS_READY_SQL,
    );
    return row?.name === 'kidding_season_marks';
  } catch {
    return false;
  }
}

async function currentFarmTagHolders(
  tx: Sql,
  farmId: string,
  excludeAnimalId: string,
): Promise<CurrentTagHolder[]> {
  const rows = await tx.getAll<Record<string, unknown>>(
    `SELECT id, name, tag_number, official_id
     FROM animals
     WHERE farm_id = ? AND id != ? AND tag_number IS NOT NULL`,
    [farmId, excludeAnimalId],
  );
  const holders: CurrentTagHolder[] = [];
  for (const row of rows) {
    const value = normalizeTagValue(
      row.tag_number != null ? String(row.tag_number) : null,
    );
    if (!value) {
      continue;
    }
    holders.push({
      animalId: String(row.id),
      value,
      label: animalDisplayLabel({
        name: row.name != null ? String(row.name) : null,
        tagNumber: value,
        officialId: row.official_id != null ? String(row.official_id) : null,
      }),
    });
  }

  if (!(await tagHistoryTableReady(tx))) {
    return holders;
  }

  const historyRows = await tx.getAll<Record<string, unknown>>(
    `SELECT h.animal_id, h.value, a.name, a.tag_number, a.official_id
     FROM tag_history h
     JOIN animals a ON a.id = h.animal_id
     WHERE h.farm_id = ? AND h.kind = 'farm_tag' AND h.ended_on IS NULL AND h.animal_id != ?`,
    [farmId, excludeAnimalId],
  );
  for (const row of historyRows) {
    const value = normalizeTagValue(
      row.value != null ? String(row.value) : null,
    );
    if (!value) {
      continue;
    }
    const animalId = String(row.animal_id);
    if (
      holders.some(
        (holder) => holder.animalId === animalId && holder.value.toLowerCase() === value.toLowerCase(),
      )
    ) {
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

async function resolveBreeding(
  tx: Sql,
  farmId: string,
  damId: string,
  breedingEventId: string | null,
): Promise<{
  id: string;
  sireId: string | null;
  sireExternalName: string | null;
} | null> {
  if (breedingEventId) {
    const row = await tx.getOptional<Record<string, unknown>>(
      `SELECT id, status, dam_id, sire_id, sire_external_name
       FROM breeding_events WHERE id = ?`,
      [breedingEventId],
    );
    if (
      row &&
      String(row.dam_id) === damId &&
      isBreedingOpenForKidding(String(row.status) as BreedingStatus)
    ) {
      return {
        id: String(row.id),
        sireId: row.sire_id != null ? String(row.sire_id) : null,
        sireExternalName:
          row.sire_external_name != null ? String(row.sire_external_name) : null,
      };
    }
  }

  const latest = await tx.getOptional<Record<string, unknown>>(
    `SELECT id, sire_id, sire_external_name
     FROM breeding_events
     WHERE farm_id = ? AND dam_id = ? AND status IN ('bred', 'confirmed')
     ORDER BY bred_date DESC
     LIMIT 1`,
    [farmId, damId],
  );
  if (!latest) {
    return null;
  }
  return {
    id: String(latest.id),
    sireId: latest.sire_id != null ? String(latest.sire_id) : null,
    sireExternalName:
      latest.sire_external_name != null
        ? String(latest.sire_external_name)
        : null,
  };
}

/**
 * Inserts the kidding, one animal per kid, tag history for tags entered,
 * and birth weights with no weigh session. Caller must run this inside one
 * write transaction so a failure rolls every row back.
 */
export async function applyFastKidding(
  tx: Sql,
  input: {
    farmId: string;
    damId: string;
    kidDate: string;
    kids: readonly PreparedKid[];
    breedingEventId?: string | null;
    weaningDays?: number | null;
    weightUnit: 'lb' | 'kg';
    damLabel: string;
    createdBy: string | null;
    now: string;
    newId: () => string;
  },
): Promise<FastKiddingResult> {
  if (input.kids.length < 1) {
    throw new Error('Add at least one kid.');
  }

  const needsTagHistory = input.kids.some((kid) => kid.tagNumber);
  if (needsTagHistory && !(await tagHistoryTableReady(tx))) {
    throw new Error(FAST_KIDDING_TAG_HISTORY_UNAVAILABLE);
  }

  const kiddingId = input.newId();
  const alive = input.kids.filter((kid) => kid.outcome === 'alive').length;
  const breeding = await resolveBreeding(
    tx,
    input.farmId,
    input.damId,
    input.breedingEventId ?? null,
  );

  await tx.execute(
    `INSERT INTO kidding_events (
      id, farm_id, dam_id, sire_id, sire_external_name,
      kid_date, kids_born, kids_surviving, kidding_ease, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    [
      kiddingId,
      input.farmId,
      input.damId,
      breeding?.sireId ?? null,
      breeding?.sireExternalName ?? null,
      input.kidDate,
      input.kids.length,
      alive,
      input.now,
      input.now,
    ],
  );

  if (breeding) {
    await tx.execute(
      `UPDATE breeding_events
       SET status = 'kidded', kidding_event_id = ?, updated_at = ?
       WHERE id = ?`,
      [kiddingId, input.now, breeding.id],
    );
    await tx.execute(
      `UPDATE tasks
       SET completed = 1, updated_at = ?
       WHERE source = 'breeding' AND source_id = ? AND completed = 0`,
      [input.now, breeding.id],
    );
  }

  const damRow = await tx.getOptional<{ breed_primary_id: string | null }>(
    'SELECT breed_primary_id FROM animals WHERE id = ?',
    [input.damId],
  );
  let sireBreed: string | null = null;
  if (breeding?.sireId) {
    const sireRow = await tx.getOptional<{ breed_primary_id: string | null }>(
      'SELECT breed_primary_id FROM animals WHERE id = ?',
      [breeding.sireId],
    );
    sireBreed = sireRow?.breed_primary_id ?? null;
  }
  const breedId = kidInheritsBreed(damRow?.breed_primary_id ?? null, sireBreed);

  const kidIds: string[] = [];
  for (const kid of input.kids) {
    const kidId = input.newId();
    kidIds.push(kidId);
    const died = kid.outcome === 'dead';
    await tx.execute(
      `INSERT INTO animals (
        id, farm_id, name, tag_number, sex, status, lifecycle_stage,
        purpose, breed_primary_id, date_of_birth, dam_id, sire_id,
        sire_external_name, litter_id, color, birth_order, out_date,
        created_at, updated_at
      ) VALUES (?, ?, NULL, ?, ?, ?, 'kid', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        kidId,
        input.farmId,
        kid.tagNumber,
        kid.sex,
        died ? 'died' : 'active',
        breedId,
        input.kidDate,
        input.damId,
        breeding?.sireId ?? null,
        breeding?.sireExternalName ?? null,
        kiddingId,
        kid.color,
        kid.birthOrder,
        died ? input.kidDate : null,
        input.now,
        input.now,
      ],
    );

    if (kid.tagNumber) {
      const holders = await currentFarmTagHolders(tx, input.farmId, kidId);
      const plan = planTagChange({
        action: 'add',
        kind: 'farm_tag',
        currentValue: null,
        nextValue: kid.tagNumber,
        note: null,
        today: input.kidDate,
        openHistoryId: null,
        holders,
        animalId: kidId,
      });
      if (!plan.ok || !plan.insertOpen) {
        throw new Error(
          plan.ok
            ? currentTagDuplicateMessage('farm_tag', kid.tagNumber, 'another goat')
            : plan.message,
        );
      }
      await tx.execute(
        `INSERT INTO tag_history (
          id, farm_id, animal_id, kind, value, started_on, ended_on, note, created_at, created_by
        ) VALUES (?, ?, ?, 'farm_tag', ?, ?, NULL, NULL, ?, ?)`,
        [
          input.newId(),
          input.farmId,
          kidId,
          plan.insertOpen.value,
          plan.insertOpen.startedOn,
          input.now,
          input.createdBy,
        ],
      );
    }

    if (kid.birthWeight != null) {
      await tx.execute(
        `INSERT INTO weight_logs (
          id, farm_id, weigh_session_id, animal_id, weight_value, weight_unit, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
        [
          input.newId(),
          input.farmId,
          kidId,
          kid.birthWeight,
          input.weightUnit,
          input.now,
          input.now,
        ],
      );
    }
  }

  if (input.weaningDays != null && input.weaningDays > 0 && alive > 0) {
    const weanDue = addDaysToIso(input.kidDate, input.weaningDays);
    if (weanDue) {
      await tx.execute(
        `INSERT INTO tasks (
          id, farm_id, title, due_date, priority, source, source_id, completed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'medium', 'weaning', ?, 0, ?, ?)`,
        [
          input.newId(),
          input.farmId,
          weaningTaskTitle(input.damLabel),
          weanDue,
          kiddingId,
          input.now,
          input.now,
        ],
      );
    }
  }

  return { kiddingId, kidIds, kids: [...input.kids] };
}

export async function undoFastKidding(
  tx: Sql,
  input: { kiddingId: string; now: string },
): Promise<void> {
  const kids = await tx.getAll<{ id: string }>(
    'SELECT id FROM animals WHERE litter_id = ?',
    [input.kiddingId],
  );
  const historyReady = await tagHistoryTableReady(tx);
  for (const kid of kids) {
    await tx.execute('DELETE FROM weight_logs WHERE animal_id = ?', [kid.id]);
    if (historyReady) {
      await tx.execute('DELETE FROM tag_history WHERE animal_id = ?', [kid.id]);
    }
    await tx.execute('DELETE FROM animals WHERE id = ?', [kid.id]);
  }
  await tx.execute(
    `DELETE FROM tasks
     WHERE source = 'weaning' AND source_id = ? AND completed = 0`,
    [input.kiddingId],
  );
  await tx.execute('DELETE FROM kidding_events WHERE id = ?', [input.kiddingId]);

  const breeding = await tx.getOptional<{ id: string }>(
    'SELECT id FROM breeding_events WHERE kidding_event_id = ?',
    [input.kiddingId],
  );
  if (breeding) {
    await tx.execute(
      `UPDATE breeding_events
       SET status = 'bred', kidding_event_id = NULL, updated_at = ?
       WHERE id = ?`,
      [input.now, breeding.id],
    );
  }
}

export async function markDoeOpenThisSeason(
  tx: Sql,
  input: {
    farmId: string;
    animalId: string;
    seasonStart: string;
    createdBy: string | null;
    now: string;
    newId: () => string;
  },
): Promise<void> {
  if (!(await kiddingSeasonMarksReady(tx))) {
    throw new Error(KIDDING_SEASON_MARKS_UNAVAILABLE);
  }
  const existing = await tx.getOptional<{ id: string }>(
    `SELECT id FROM kidding_season_marks
     WHERE animal_id = ? AND season_start = ?
     LIMIT 1`,
    [input.animalId, input.seasonStart],
  );
  if (existing) {
    return;
  }
  await tx.execute(
    `INSERT INTO kidding_season_marks (
      id, farm_id, animal_id, season_start, kind, created_at, created_by
    ) VALUES (?, ?, ?, ?, 'open', ?, ?)`,
    [
      input.newId(),
      input.farmId,
      input.animalId,
      input.seasonStart,
      input.now,
      input.createdBy,
    ],
  );
}

export function doeMatchesKiddingSearch(
  animal: Pick<Animal, 'sex' | 'status'>,
): boolean {
  return animal.sex === 'female' && animal.status === 'active';
}
