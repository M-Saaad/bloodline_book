export const ANIMAL_NOT_ON_FARM = 'That goat is not on this farm.';

export const RECORD_NOT_ON_FARM = 'That record is not on this farm.';

const RECORD_TABLES = {
  breeding_events: 'breeding_events',
  kidding_events: 'kidding_events',
  health_records: 'health_records',
  weight_logs: 'weight_logs',
  weigh_sessions: 'weigh_sessions',
  pastures: 'pastures',
} as const;

export type FarmRecordTable = keyof typeof RECORD_TABLES;

type FarmReader = {
  getAll<T>(query: string, parameters?: any[]): Promise<T[]>;
  getOptional<T>(query: string, parameters?: any[]): Promise<T | null>;
};

/**
 * Ids that still exist on the herd currently loaded for the active farm.
 * Drops a route param left behind after the farm switcher.
 */
export function idsOnHerd(
  ids: readonly (string | null | undefined)[],
  herd: readonly { id: string }[],
): string[] {
  const allowed = new Set(herd.map((animal) => animal.id));
  const kept: string[] = [];
  for (const id of ids) {
    if (id && allowed.has(id) && !kept.includes(id)) {
      kept.push(id);
    }
  }
  return kept;
}

export async function assertAnimalsOnFarm(
  db: Pick<FarmReader, 'getAll'>,
  farmId: string,
  animalIds: readonly (string | null | undefined)[],
): Promise<void> {
  const ids: string[] = [];
  for (const id of animalIds) {
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  if (ids.length === 0) {
    return;
  }

  const placeholders = ids.map(() => '?').join(', ');
  const rows = await db.getAll<{ id: string; farm_id: string }>(
    `SELECT id, farm_id FROM animals WHERE id IN (${placeholders})`,
    ids,
  );
  const farmById = new Map(
    rows.map((row) => [String(row.id), String(row.farm_id)]),
  );
  for (const id of ids) {
    if (farmById.get(id) !== farmId) {
      throw new Error(ANIMAL_NOT_ON_FARM);
    }
  }
}

export async function assertRecordOnFarm(
  db: Pick<FarmReader, 'getOptional'>,
  table: FarmRecordTable,
  recordId: string,
  farmId: string,
): Promise<void> {
  const row = await db.getOptional<{ farm_id: string }>(
    `SELECT farm_id FROM ${RECORD_TABLES[table]} WHERE id = ?`,
    [recordId],
  );
  if (!row || String(row.farm_id) !== farmId) {
    throw new Error(RECORD_NOT_ON_FARM);
  }
}
