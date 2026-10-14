import { randomUUID } from 'node:crypto';

import {
  formatMappingForPrint,
  guessColumnMapping,
  mergeColumnMapping,
  pickMappedRow,
} from './column-map.mjs';
import {
  buildAnimalLookup,
  lookupHasAmbiguity,
  resolveParentReference,
} from './pedigree.mjs';
import {
  appendNote,
  cleanText,
  inferLifecycleStage,
  normalizeDateOfBirth,
  normalizeLookupKey,
  normalizeSex,
  parseBreedPercentage,
  parseRegistrationBody,
  resolveBreedName,
  validateNameOrTag,
} from './normalize.mjs';

export { formatMappingForPrint, guessColumnMapping, mergeColumnMapping };

/**
 * @typedef {object} ExistingAnimal
 * @property {string} id
 * @property {string | null} name
 * @property {string | null} tag_number
 */

/**
 * @typedef {object} BreedRow
 * @property {string} id
 * @property {string} name
 * @property {string | null} farm_id
 */

/**
 * @param {{
 *   rows: Record<string, unknown>[],
 *   headers: string[],
 *   mapping: Record<string, string>,
 *   existingAnimals: ExistingAnimal[],
 *   breeds: BreedRow[],
 *   referenceIso: string,
 * }} input
 */
export function buildImportPlan(input) {
  const problems = [];
  const skipped = [];
  const toInsert = [];
  const newBreeds = new Map();

  const existingByTag = new Map();
  const existingByName = new Map();
  for (const animal of input.existingAnimals) {
    const tagKey = normalizeLookupKey(animal.tag_number);
    if (tagKey) {
      existingByTag.set(tagKey, animal);
    }
    const nameKey = normalizeLookupKey(animal.name);
    if (nameKey) {
      existingByName.set(nameKey, animal);
    }
  }

  const fileTagSeen = new Map();
  const fileNameSeen = new Map();
  const staged = [];

  for (let index = 0; index < input.rows.length; index += 1) {
    const sourceRow = input.rows[index];
    const rowNum = index + 2;
    const mapped = pickMappedRow(input.mapping, sourceRow);
    const label =
      cleanText(mapped.tag) ??
      cleanText(mapped.name) ??
      `row ${rowNum}`;

    const name = cleanText(mapped.name);
    const tag = cleanText(mapped.tag);
    const nameTagProblem = validateNameOrTag(name, tag);
    if (nameTagProblem) {
      problems.push({ row: rowNum, label, reason: nameTagProblem });
      continue;
    }

    const tagKey = normalizeLookupKey(tag);
    const nameKey = normalizeLookupKey(name);

    const existing =
      (tagKey && existingByTag.get(tagKey)) ||
      (nameKey && existingByName.get(nameKey)) ||
      null;
    if (existing) {
      skipped.push({
        row: rowNum,
        label,
        reason: `Already in farm (${existing.tag_number ?? existing.name})`,
      });
      continue;
    }

    if (tagKey) {
      if (fileTagSeen.has(tagKey)) {
        problems.push({
          row: rowNum,
          label,
          reason: `Duplicate tag in file (first at row ${fileTagSeen.get(tagKey)})`,
        });
        continue;
      }
      fileTagSeen.set(tagKey, rowNum);
    }
    if (nameKey) {
      if (fileNameSeen.has(nameKey)) {
        problems.push({
          row: rowNum,
          label,
          reason: `Duplicate name in file (first at row ${fileNameSeen.get(nameKey)})`,
        });
        continue;
      }
      fileNameSeen.set(nameKey, rowNum);
    }

    const sexBits = normalizeSex(mapped.sex);
    if (!sexBits.sex) {
      problems.push({
        row: rowNum,
        label,
        reason: sexBits.problem ?? 'Missing sex',
      });
      continue;
    }

    const dobBits = normalizeDateOfBirth(mapped.dob, input.referenceIso);
    if (dobBits.problem) {
      problems.push({ row: rowNum, label, reason: dobBits.problem });
      continue;
    }

    const pctBits = parseBreedPercentage(mapped.breed_percent);
    if (pctBits.problem) {
      problems.push({ row: rowNum, label, reason: pctBits.problem });
      continue;
    }

    const regBodyBits = parseRegistrationBody(mapped.reg_body);
    if (regBodyBits.problem) {
      problems.push({ row: rowNum, label, reason: regBodyBits.problem });
      continue;
    }

    let notes = cleanText(mapped.notes);
    if (sexBits.wetherNote) {
      notes = appendNote(notes, 'wether');
    }

    const breedBits = resolveBreedName(mapped.breed, input.breeds);
    let breedPrimaryId = breedBits.breedId;
    if (breedBits.createFarmBreed && breedBits.canonicalName) {
      const breedKey = normalizeLookupKey(breedBits.canonicalName);
      let pending = newBreeds.get(breedKey);
      if (!pending) {
        pending = {
          id: randomUUID(),
          name: breedBits.canonicalName,
          segment: 'meat',
        };
        newBreeds.set(breedKey, pending);
      }
      breedPrimaryId = pending.id;
    }

    const id = randomUUID();
    const lifecycleStage = inferLifecycleStage(
      dobBits.iso,
      sexBits.sex,
      input.referenceIso,
    );

    staged.push({
      row: rowNum,
      label,
      id,
      name,
      tag_number: tag,
      sex: sexBits.sex,
      date_of_birth: dobBits.iso,
      lifecycle_stage: lifecycleStage,
      breed_primary_id: breedPrimaryId,
      breed_percentage: pctBits.value,
      registration_body: regBodyBits.body,
      registration_number: cleanText(mapped.reg_number),
      tattoo: cleanText(mapped.tattoo),
      notes,
      dam_raw: cleanText(mapped.dam),
      sire_raw: cleanText(mapped.sire),
    });
  }

  const lookupAnimals = [
    ...input.existingAnimals.map((a) => ({
      id: a.id,
      name: a.name,
      tag_number: a.tag_number,
    })),
    ...staged.map((s) => ({
      id: s.id,
      name: s.name,
      tag_number: s.tag_number,
    })),
  ];
  const lookup = buildAnimalLookup(lookupAnimals);
  if (lookupHasAmbiguity(lookup)) {
    problems.push({
      row: 0,
      label: '(herd)',
      reason:
        'Ambiguous tag or name in farm or import file — fix duplicates before import',
    });
  }

  for (const row of staged) {
    const dam = resolveParentReference(row.dam_raw, lookup);
    const sire = resolveParentReference(row.sire_raw, lookup);
    const rowProblems = [];
    if (dam.problem) {
      rowProblems.push(dam.problem);
    }
    if (sire.problem) {
      rowProblems.push(sire.problem);
    }
    if (rowProblems.length) {
      problems.push({
        row: row.row,
        label: row.label,
        reason: rowProblems.join('; '),
      });
      continue;
    }

    toInsert.push({
      row: row.row,
      label: row.label,
      record: {
        id: row.id,
        name: row.name,
        tag_number: row.tag_number,
        sex: row.sex,
        date_of_birth: row.date_of_birth,
        status: 'active',
        lifecycle_stage: row.lifecycle_stage,
        breed_primary_id: row.breed_primary_id,
        breed_percentage: row.breed_percentage,
        dam_id: dam.id,
        sire_id: sire.id,
        dam_external_name: dam.externalName,
        sire_external_name: sire.externalName,
        registration_body: row.registration_body,
        registration_number: row.registration_number,
        tattoo: row.tattoo,
        notes: row.notes,
      },
    });
  }

  return {
    toInsert,
    skipped,
    problems,
    newBreeds: [...newBreeds.values()],
  };
}
