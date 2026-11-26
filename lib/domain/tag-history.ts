export const TAG_KINDS = ['farm_tag', 'official_id', 'tattoo'] as const;

export type TagKind = (typeof TAG_KINDS)[number];

export type TagColumn = 'tag_number' | 'official_id' | 'tattoo';

export const TAG_KIND_COLUMN: Record<TagKind, TagColumn> = {
  farm_tag: 'tag_number',
  official_id: 'official_id',
  tattoo: 'tattoo',
};

export type TagChangeAction = 'add' | 'replace' | 'clear';

export type CurrentTagHolder = {
  animalId: string;
  value: string;
  label: string;
};

export type TagChangePlan =
  | { ok: false; message: string }
  | {
      ok: true;
      kind: TagKind;
      column: TagColumn;
      nextValue: string | null;
      closeOpenId: string | null;
      closeNote: string | null;
      insertOpen: { value: string; note: string | null; startedOn: string } | null;
      reviseOpenId: string | null;
      reviseValue: string | null;
    };

export function tagKindLabel(kind: TagKind): string {
  switch (kind) {
    case 'farm_tag':
      return 'Farm tag';
    case 'official_id':
      return 'Official ID';
    case 'tattoo':
      return 'Tattoo';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function normalizeTagValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function tagValuesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeTagValue(left);
  const b = normalizeTagValue(right);
  if (a == null || b == null) {
    return a == null && b == null;
  }
  return a.toLowerCase() === b.toLowerCase();
}

export function currentTagDuplicateMessage(
  kind: TagKind,
  value: string,
  otherLabel: string,
): string {
  const label = tagKindLabel(kind);
  return `${label} ${value} is already on ${otherLabel}. Two goats on this farm cannot share the same current ${label.toLowerCase()}.`;
}

export const TAG_HISTORY_NOT_ON_PHONE =
  'Tag history for this goat is not on this phone yet. Wait for sync, then try again.';

type SqlReader = {
  getOptional<T>(sql: string, parameters?: unknown[]): Promise<T | null>;
};

/**
 * PowerSync keeps synced rows in `ps_data__tag_history` and exposes
 * `tag_history` as a view. A plain SQLite table of the same name also counts.
 */
export const TAG_HISTORY_READY_SQL =
  "SELECT name FROM sqlite_master WHERE name = 'tag_history' AND type IN ('table', 'view')";

export async function tagHistoryTableReady(db: SqlReader): Promise<boolean> {
  try {
    const row = await db.getOptional<{ name: string }>(TAG_HISTORY_READY_SQL);
    return row?.name === 'tag_history';
  } catch {
    return false;
  }
}

export function planTagChange(input: {
  action: TagChangeAction;
  kind: TagKind;
  currentValue: string | null;
  nextValue: string | null;
  note: string | null;
  today: string;
  openHistoryId: string | null;
  holders: readonly CurrentTagHolder[];
  animalId: string;
}): TagChangePlan {
  const kindLabel = tagKindLabel(input.kind);
  const current = normalizeTagValue(input.currentValue);
  const requested = normalizeTagValue(input.nextValue);
  const note = normalizeTagValue(input.note);
  const next = input.action === 'clear' ? null : requested;

  if (input.action === 'add') {
    if (current) {
      return {
        ok: false,
        message: `${kindLabel} is already ${current}. Use replace to change it.`,
      };
    }
    if (!next) {
      return { ok: false, message: `Enter the new ${kindLabel.toLowerCase()}.` };
    }
  }

  if (input.action === 'replace') {
    if (!current) {
      return {
        ok: false,
        message: `This goat has no ${kindLabel.toLowerCase()} yet. Add one instead.`,
      };
    }
    if (!next) {
      return { ok: false, message: `Enter the new ${kindLabel.toLowerCase()}.` };
    }
  }

  if (input.action === 'clear') {
    if (!current) {
      return {
        ok: false,
        message: `This goat has no ${kindLabel.toLowerCase()} to remove.`,
      };
    }
  }

  if (input.action !== 'add' && !input.openHistoryId) {
    return { ok: false, message: TAG_HISTORY_NOT_ON_PHONE };
  }

  const spellingOnly =
    input.action === 'replace' &&
    current != null &&
    next != null &&
    tagValuesMatch(current, next);

  if (spellingOnly && current === next) {
    return {
      ok: false,
      message: `That's already the current ${kindLabel.toLowerCase()}.`,
    };
  }

  if (next && !spellingOnly) {
    const clash = input.holders.find(
      (holder) =>
        holder.animalId !== input.animalId && tagValuesMatch(holder.value, next),
    );
    if (clash) {
      return {
        ok: false,
        message: currentTagDuplicateMessage(input.kind, next, clash.label),
      };
    }
  }

  const column = TAG_KIND_COLUMN[input.kind];

  if (spellingOnly && next) {
    return {
      ok: true,
      kind: input.kind,
      column,
      nextValue: next,
      closeOpenId: null,
      closeNote: null,
      insertOpen: null,
      reviseOpenId: input.openHistoryId,
      reviseValue: next,
    };
  }

  const closing = input.action !== 'add' && current != null;
  return {
    ok: true,
    kind: input.kind,
    column,
    nextValue: next,
    closeOpenId: closing ? input.openHistoryId : null,
    closeNote: input.action === 'clear' ? note : null,
    insertOpen: next ? { value: next, note, startedOn: input.today } : null,
    reviseOpenId: null,
    reviseValue: null,
  };
}

export type BackfillAnimal = {
  id: string;
  farmId: string;
  tagNumber: string | null;
  officialId: string | null;
  tattoo: string | null;
};

export type BackfillTagRow = {
  farmId: string;
  animalId: string;
  kind: TagKind;
  value: string;
};

export function backfillTagHistory(
  animals: readonly BackfillAnimal[],
  existingOpen: readonly { animalId: string; kind: TagKind }[],
): BackfillTagRow[] {
  const open = new Set(existingOpen.map((row) => `${row.animalId}:${row.kind}`));
  const rows: BackfillTagRow[] = [];

  for (const animal of animals) {
    const pairs: readonly [TagKind, string | null][] = [
      ['farm_tag', animal.tagNumber],
      ['official_id', animal.officialId],
      ['tattoo', animal.tattoo],
    ];
    for (const [kind, raw] of pairs) {
      const value = normalizeTagValue(raw);
      if (!value) {
        continue;
      }
      const key = `${animal.id}:${kind}`;
      if (open.has(key)) {
        continue;
      }
      open.add(key);
      rows.push({
        farmId: animal.farmId,
        animalId: animal.id,
        kind,
        value,
      });
    }
  }

  return rows;
}

export function sortTagHistory<
  T extends { endedOn: string | null; startedOn: string | null; createdAt: string },
>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const aCurrent = a.endedOn == null;
    const bCurrent = b.endedOn == null;
    if (aCurrent !== bCurrent) {
      return aCurrent ? -1 : 1;
    }
    const ended = (b.endedOn ?? '').localeCompare(a.endedOn ?? '');
    if (ended !== 0) {
      return ended;
    }
    const started = (b.startedOn ?? '').localeCompare(a.startedOn ?? '');
    if (started !== 0) {
      return started;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

type SearchableAnimal = {
  name?: string | null;
  tagNumber?: string | null;
  officialId?: string | null;
  registrationNumber?: string | null;
  tattoo?: string | null;
};

function currentSearchFields(animal: SearchableAnimal): (string | null | undefined)[] {
  return [
    animal.name,
    animal.tagNumber,
    animal.officialId,
    animal.registrationNumber,
    animal.tattoo,
  ];
}

function fieldMatches(value: string | null | undefined, normalized: string): boolean {
  return value?.toLowerCase().includes(normalized) ?? false;
}

export function pastTagSearchHint(
  animal: SearchableAnimal,
  query: string,
  pastTagValues: readonly string[] = [],
): string | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (currentSearchFields(animal).some((value) => fieldMatches(value, normalized))) {
    return null;
  }
  const hits = pastTagValues.filter((value) => fieldMatches(value, normalized));
  if (hits.length === 0) {
    return null;
  }
  hits.sort((a, b) => {
    const aExact = a.trim().toLowerCase() === normalized ? 0 : 1;
    const bExact = b.trim().toLowerCase() === normalized ? 0 : 1;
    if (aExact !== bExact) {
      return aExact - bExact;
    }
    return a.length - b.length;
  });
  return `was ${hits[0].trim()}`;
}

export function pastTagValuesByAnimal(
  rows: readonly { animalId: string; value: string }[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    const value = row.value.trim();
    if (!row.animalId || !value) {
      continue;
    }
    const list = map[row.animalId] ?? [];
    list.push(value);
    map[row.animalId] = list;
  }
  return map;
}
