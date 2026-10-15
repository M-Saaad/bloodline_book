import type { Animal } from '@/lib/types/animals';

export const ADD_ANIMAL_SESSION_PARAM = 'session';

export type AddAnimalDraft = {
  name: string;
  tagNumber: string;
  officialId: string;
  registrationBody: Animal['registrationBody'];
  registrationNumber: string;
  tattoo: string;
  sex: Animal['sex'];
  breedId: string | null;
  breedPercentage: string;
  dateOfBirth: string;
  damId: string | null;
  damExternalName: string;
  sireId: string | null;
  sireExternalName: string;
};

export function createEmptyAddAnimalDraft(): AddAnimalDraft {
  return {
    name: '',
    tagNumber: '',
    officialId: '',
    registrationBody: null,
    registrationNumber: '',
    tattoo: '',
    sex: 'female',
    breedId: null,
    breedPercentage: '',
    dateOfBirth: '',
    damId: null,
    damExternalName: '',
    sireId: null,
    sireExternalName: '',
  };
}

/** Identity fields stay blank so a duplicate is a new animal record. */
export function addAnimalDraftFromDuplicateSource(animal: Animal): AddAnimalDraft {
  return {
    ...createEmptyAddAnimalDraft(),
    registrationBody: animal.registrationBody,
    registrationNumber: animal.registrationNumber ?? '',
    tattoo: animal.tattoo ?? '',
    sex: animal.sex,
    breedId: animal.breedPrimaryId,
    breedPercentage:
      animal.breedPercentage != null ? String(animal.breedPercentage) : '',
    dateOfBirth: animal.dateOfBirth ?? '',
    damId: animal.damId,
    damExternalName: animal.damExternalName ?? '',
    sireId: animal.sireId,
    sireExternalName: animal.sireExternalName ?? '',
  };
}

/**
 * Clear stale draft state only when navigation supplies a new Add goat session id
 * (successful save + open again, or any explicit new-add entry point).
 */
export function shouldResetAddAnimalDraftForSession(
  routeSessionId: string,
  committedSessionId: string | null,
  params: { duplicateFrom?: string; prefill?: string },
  lastAppliedDuplicatePrefill: string | null,
): boolean {
  if (routeSessionId === committedSessionId) {
    return false;
  }
  if (
    params.duplicateFrom &&
    params.prefill &&
    params.prefill !== lastAppliedDuplicatePrefill
  ) {
    return false;
  }
  return true;
}

export function shouldApplyDuplicatePrefillLoad(
  loadGenerationAtStart: number,
  currentGeneration: number,
): boolean {
  return loadGenerationAtStart === currentGeneration;
}

export function areAddAnimalDraftsEqual(
  a: AddAnimalDraft,
  b: AddAnimalDraft,
): boolean {
  return (
    a.name === b.name &&
    a.tagNumber === b.tagNumber &&
    a.officialId === b.officialId &&
    a.registrationBody === b.registrationBody &&
    a.registrationNumber === b.registrationNumber &&
    a.tattoo === b.tattoo &&
    a.sex === b.sex &&
    a.breedId === b.breedId &&
    a.breedPercentage === b.breedPercentage &&
    a.dateOfBirth === b.dateOfBirth &&
    a.damId === b.damId &&
    a.damExternalName === b.damExternalName &&
    a.sireId === b.sireId &&
    a.sireExternalName === b.sireExternalName
  );
}

export function isAddAnimalDraftDirty(
  current: AddAnimalDraft,
  baseline: AddAnimalDraft,
): boolean {
  return !areAddAnimalDraftsEqual(current, baseline);
}
