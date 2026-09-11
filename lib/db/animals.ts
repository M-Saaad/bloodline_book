import * as Crypto from 'expo-crypto';

import { mapAnimal, mapBreed } from '@/lib/db/mappers';
import { powersync } from '@/lib/powersync/system';
import type { Animal, Breed } from '@/lib/types/animals';

export async function getActiveAnimals(farmId: string): Promise<Animal[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM animals
     WHERE farm_id = ? AND status = 'active'
     ORDER BY COALESCE(name, tag_number, id)`,
    [farmId],
  );
  return rows.map(mapAnimal);
}

export async function getBreedsForFarm(
  farmId: string,
  segment: 'dairy' | 'meat' | 'both',
): Promise<Breed[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM breeds
     WHERE farm_id IS NULL OR farm_id = ?
     ORDER BY name`,
    [farmId],
  );

  return rows
    .map(mapBreed)
    .filter(
      (breed: Breed) =>
        breed.segment === segment ||
        breed.segment === 'both' ||
        segment === 'both',
    );
}

export async function createAnimal(
  farmId: string,
  input: {
    name?: string;
    tagNumber?: string;
    sex: Animal['sex'];
    breedPrimaryId?: string;
    lifecycleStage?: Animal['lifecycleStage'];
    purpose?: Animal['purpose'];
    dateOfBirth?: string;
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO animals (
      id, farm_id, name, tag_number, sex, status, lifecycle_stage,
      purpose, breed_primary_id, date_of_birth, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
    [
      id,
      farmId,
      input.name ?? null,
      input.tagNumber ?? null,
      input.sex,
      input.lifecycleStage ?? 'kid',
      input.purpose ?? null,
      input.breedPrimaryId ?? null,
      input.dateOfBirth ?? null,
      now,
      now,
    ],
  );

  return id;
}

export async function getAnimalById(animalId: string): Promise<Animal | null> {
  const row = await powersync.getOptional<Record<string, unknown>>(
    'SELECT * FROM animals WHERE id = ?',
    [animalId],
  );
  return row ? mapAnimal(row) : null;
}
