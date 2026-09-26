import AsyncStorage from '@react-native-async-storage/async-storage';

import type { OutsideAnimal } from '@/lib/ui/animal-picker';
import type { Animal } from '@/lib/types/animals';
import type { WeighSession } from '@/lib/types/weight';

const RECENT_LIMIT = 8;

export type WeighGroup =
  | { kind: 'herd' }
  | { kind: 'kids' }
  | { kind: 'pasture'; pastureId: string };

export type WeighMemory = {
  weighPoint: WeighSession['weighPoint'];
  group: WeighGroup;
  markWeaned: boolean;
};

function recentKey(farmId: string) {
  return `bloodline.recents.${farmId}`;
}

function outsideKey(farmId: string) {
  return `bloodline.outside.${farmId}`;
}

function weighKey(farmId: string) {
  return `bloodline.weigh.${farmId}`;
}

export async function loadRecentAnimalIds(farmId: string): Promise<string[]> {
  return readStringList(recentKey(farmId)).then((ids) => ids.slice(0, RECENT_LIMIT));
}

export async function rememberAnimalId(
  farmId: string,
  animalId: string,
): Promise<void> {
  const current = await loadRecentAnimalIds(farmId);
  const next = [animalId, ...current.filter((id) => id !== animalId)].slice(
    0,
    RECENT_LIMIT,
  );
  await AsyncStorage.setItem(recentKey(farmId), JSON.stringify(next));
}

export async function loadOutsideAnimals(
  farmId: string,
): Promise<OutsideAnimal[]> {
  const raw = await AsyncStorage.getItem(outsideKey(farmId));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isOutsideAnimal);
  } catch {
    return [];
  }
}

export async function saveOutsideAnimal(
  farmId: string,
  animal: OutsideAnimal,
): Promise<OutsideAnimal[]> {
  const current = await loadOutsideAnimals(farmId);
  const next = [animal, ...current.filter((item) => item.id !== animal.id)];
  await AsyncStorage.setItem(outsideKey(farmId), JSON.stringify(next));
  return next;
}

export async function loadWeighMemory(
  farmId: string,
): Promise<WeighMemory | null> {
  const raw = await AsyncStorage.getItem(weighKey(farmId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<WeighMemory>;
    if (!parsed || typeof parsed !== 'object' || !parsed.weighPoint || !parsed.group) {
      return null;
    }
    return {
      weighPoint: parsed.weighPoint,
      group: parsed.group,
      markWeaned: Boolean(parsed.markWeaned),
    };
  } catch {
    return null;
  }
}

export async function saveWeighMemory(
  farmId: string,
  memory: WeighMemory,
): Promise<void> {
  await AsyncStorage.setItem(weighKey(farmId), JSON.stringify(memory));
}

async function readStringList(key: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function isOutsideAnimal(value: unknown): value is OutsideAnimal {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<OutsideAnimal>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    (record.sex === 'female' || record.sex === 'male')
  );
}

export function outsideRecentId(outsideId: string): string {
  return `outside:${outsideId}`;
}

export function isKnownWeighPoint(
  value: string,
): value is WeighSession['weighPoint'] {
  switch (value) {
    case 'ad_hoc':
    case 'birth':
    case '30_day':
    case '60_day':
    case '90_day':
    case 'weaning':
    case 'yearling':
      return true;
    default:
      return false;
  }
}

export function emptyOutsideAnimal(sex: Animal['sex']): OutsideAnimal {
  return {
    id: '',
    name: '',
    sex,
    registrationBody: null,
    registrationNumber: null,
    breedName: null,
  };
}
