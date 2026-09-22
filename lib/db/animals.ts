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
    damId?: string;
    sireId?: string;
    sireExternalName?: string;
    litterId?: string;
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO animals (
      id, farm_id, name, tag_number, sex, status, lifecycle_stage,
      purpose, breed_primary_id, date_of_birth, dam_id, sire_id,
      sire_external_name, litter_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.damId ?? null,
      input.sireId ?? null,
      input.sireExternalName ?? null,
      input.litterId ?? null,
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

export async function getBreedName(breedId: string): Promise<string | null> {
  const row = await powersync.getOptional<Record<string, unknown>>(
    'SELECT name FROM breeds WHERE id = ?',
    [breedId],
  );
  return row?.name != null ? String(row.name) : null;
}

export async function updateAnimal(
  animalId: string,
  input: {
    name?: string | null;
    tagNumber?: string | null;
    sex?: Animal['sex'];
    breedPrimaryId?: string | null;
    lifecycleStage?: Animal['lifecycleStage'];
    status?: Animal['status'];
    notes?: string | null;
    dateOfBirth?: string | null;
    outDate?: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    fields.push('name = ?');
    values.push(input.name);
  }
  if (input.tagNumber !== undefined) {
    fields.push('tag_number = ?');
    values.push(input.tagNumber);
  }
  if (input.sex !== undefined) {
    fields.push('sex = ?');
    values.push(input.sex);
  }
  if (input.breedPrimaryId !== undefined) {
    fields.push('breed_primary_id = ?');
    values.push(input.breedPrimaryId);
  }
  if (input.lifecycleStage !== undefined) {
    fields.push('lifecycle_stage = ?');
    values.push(input.lifecycleStage);
  }
  if (input.status !== undefined) {
    fields.push('status = ?');
    values.push(input.status);
  }
  if (input.notes !== undefined) {
    fields.push('notes = ?');
    values.push(input.notes);
  }
  if (input.dateOfBirth !== undefined) {
    fields.push('date_of_birth = ?');
    values.push(input.dateOfBirth);
  }
  if (input.outDate !== undefined) {
    fields.push('out_date = ?');
    values.push(input.outDate);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(animalId);

  await powersync.execute(
    `UPDATE animals SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}
