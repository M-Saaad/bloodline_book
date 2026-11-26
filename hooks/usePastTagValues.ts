import { useQuery } from '@powersync/react';
import { useMemo } from 'react';

import { pastTagValuesByAnimal } from '@/lib/domain/tag-history';

const EMPTY: Record<string, string[]> = {};

/**
 * Past tag values keyed by animal. An empty map when tag history is not
 * syncing yet, so search keeps working on current names and tags.
 */
export function usePastTagValues(
  farmId: string | null | undefined,
): Record<string, string[]> {
  const { data, error } = useQuery(
    farmId
      ? `SELECT animal_id, value FROM tag_history
         WHERE farm_id = ? AND ended_on IS NOT NULL`
      : 'SELECT 1 WHERE 0',
    farmId ? [farmId] : [],
  );

  return useMemo(() => {
    if (!farmId || error) {
      return EMPTY;
    }
    return pastTagValuesByAnimal(
      (data ?? []).map((row) => {
        const record = row as { animal_id?: unknown; value?: unknown };
        return {
          animalId: record.animal_id != null ? String(record.animal_id) : '',
          value: record.value != null ? String(record.value) : '',
        };
      }),
    );
  }, [data, error, farmId]);
}
