import { useEffect, useState } from 'react';

import { getAnimalsByFarm } from '@/lib/db/animals';
import type { Animal } from '@/lib/types/animals';

type HerdStatus = 'all' | 'active' | Animal['status'];

/** Reads the on-device herd without waiting for a PowerSync sync to finish. */
export function useLocalHerd(
  farmId: string | null | undefined,
  status: HerdStatus,
): { animals: Animal[] | null; resolved: boolean } {
  const [animals, setAnimals] = useState<Animal[] | null>(null);

  useEffect(() => {
    if (!farmId) {
      setAnimals(null);
      return;
    }

    let cancelled = false;
    setAnimals(null);
    getAnimalsByFarm(farmId, status)
      .then((rows) => {
        if (!cancelled) {
          setAnimals(rows);
        }
      })
      .catch((error: unknown) => {
        console.error('Local herd read failed:', error);
        if (!cancelled) {
          setAnimals([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [farmId, status]);

  return {
    animals,
    resolved: !farmId || animals !== null,
  };
}
