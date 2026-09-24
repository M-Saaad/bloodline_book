import * as Crypto from 'expo-crypto';

import { mapAnimal, mapBreed } from '@/lib/db/mappers';
import { powersync } from '@/lib/powersync/system';
import type { Animal, Breed } from '@/lib/types/animals';

export type AnimalWriteInput = {
  name?: string | null;
  tagNumber?: string | null;
  officialId?: string | null;
  sex?: Animal['sex'];
  breedPrimaryId?: string | null;
  breedPercentage?: number | null;
  lifecycleStage?: Animal['lifecycleStage'];
  purpose?: Animal['purpose'];
  dateOfBirth?: string | null;
  damId?: string | null;
  sireId?: string | null;
  sireExternalName?: string | null;
  litterId?: string | null;
  registrationBody?: Animal['registrationBody'];
  registrationNumber?: string | null;
  tattoo?: string | null;
  status?: Animal['status'];
  notes?: string | null;
  outDate?: string | null;
};

export async function getActiveAnimals(farmId: string): Promise<Animal[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM animals
     WHERE farm_id = ? AND status = 'active'
     ORDER BY COALESCE(name, tag_number, id)`,
    [farmId],
  );
  return rows.map(mapAnimal);
}

export async function getAnimalsByFarm(
  farmId: string,
  statusFilter: 'active' | 'all' | Animal['status'],
): Promise<Animal[]> {
  if (statusFilter === 'all') {
    const rows = await powersync.getAll<Record<string, unknown>>(
      `SELECT * FROM animals
       WHERE farm_id = ?
       ORDER BY COALESCE(name, tag_number, id)`,
      [farmId],
    );
    return rows.map(mapAnimal);
  }

  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM animals
     WHERE farm_id = ? AND status = ?
     ORDER BY COALESCE(name, tag_number, id)`,
    [farmId, statusFilter],
  );
  return rows.map(mapAnimal);
}

export async function getParentPickerAnimals(
  farmId: string,
  sex: Animal['sex'],
  excludeAnimalId?: string,
): Promise<Animal[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM animals
     WHERE farm_id = ? AND sex = ?
     ORDER BY COALESCE(name, tag_number, id)`,
    [farmId, sex],
  );

  return rows
    .map(mapAnimal)
    .filter((animal) => animal.id !== excludeAnimalId);
}

export async function findAnimalByTagNumber(
  farmId: string,
  tagNumber: string,
  excludeAnimalId?: string,
): Promise<Animal | null> {
  const trimmed = tagNumber.trim();
  if (!trimmed) {
    return null;
  }

  const row = await powersync.getOptional<Record<string, unknown>>(
    `SELECT * FROM animals
     WHERE farm_id = ? AND lower(trim(tag_number)) = lower(?)
       AND (? IS NULL OR id != ?)
     LIMIT 1`,
    [farmId, trimmed, excludeAnimalId ?? null, excludeAnimalId ?? null],
  );

  return row ? mapAnimal(row) : null;
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

export async function createFarmBreed(
  farmId: string,
  name: string,
  segment: Breed['segment'],
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO breeds (id, farm_id, name, segment, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, farmId, name.trim(), segment, now],
  );

  return id;
}

export async function createAnimal(
  farmId: string,
  input: AnimalWriteInput & { sex: Animal['sex'] },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO animals (
      id, farm_id, name, tag_number, official_id, sex, status, lifecycle_stage,
      purpose, breed_primary_id, breed_percentage, date_of_birth, dam_id, sire_id,
      sire_external_name, litter_id, registration_body, registration_number, tattoo,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      farmId,
      input.name ?? null,
      input.tagNumber ?? null,
      input.officialId ?? null,
      input.sex,
      input.lifecycleStage ?? 'kid',
      input.purpose ?? null,
      input.breedPrimaryId ?? null,
      input.breedPercentage ?? null,
      input.dateOfBirth ?? null,
      input.damId ?? null,
      input.sireId ?? null,
      input.sireExternalName ?? null,
      input.litterId ?? null,
      input.registrationBody ?? null,
      input.registrationNumber ?? null,
      input.tattoo ?? null,
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
  input: AnimalWriteInput,
): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  const assign = (column: string, value: unknown) => {
    fields.push(`${column} = ?`);
    values.push(value);
  };

  if (input.name !== undefined) {
    assign('name', input.name);
  }
  if (input.tagNumber !== undefined) {
    assign('tag_number', input.tagNumber);
  }
  if (input.officialId !== undefined) {
    assign('official_id', input.officialId);
  }
  if (input.sex !== undefined) {
    assign('sex', input.sex);
  }
  if (input.breedPrimaryId !== undefined) {
    assign('breed_primary_id', input.breedPrimaryId);
  }
  if (input.breedPercentage !== undefined) {
    assign('breed_percentage', input.breedPercentage);
  }
  if (input.lifecycleStage !== undefined) {
    assign('lifecycle_stage', input.lifecycleStage);
  }
  if (input.status !== undefined) {
    assign('status', input.status);
  }
  if (input.notes !== undefined) {
    assign('notes', input.notes);
  }
  if (input.dateOfBirth !== undefined) {
    assign('date_of_birth', input.dateOfBirth);
  }
  if (input.outDate !== undefined) {
    assign('out_date', input.outDate);
  }
  if (input.damId !== undefined) {
    assign('dam_id', input.damId);
  }
  if (input.sireId !== undefined) {
    assign('sire_id', input.sireId);
  }
  if (input.sireExternalName !== undefined) {
    assign('sire_external_name', input.sireExternalName);
  }
  if (input.registrationBody !== undefined) {
    assign('registration_body', input.registrationBody);
  }
  if (input.registrationNumber !== undefined) {
    assign('registration_number', input.registrationNumber);
  }
  if (input.tattoo !== undefined) {
    assign('tattoo', input.tattoo);
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
