import type { Animal } from '@/lib/types/animals';

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
 * Stack screens (especially on web) stay mounted when you navigate away, so Add Goat
 * must clear stale draft state when the screen is opened again.
 */
export function shouldResetAddAnimalDraftOnFocus(
  focusVisitIndex: number,
  params: { duplicateFrom?: string; prefill?: string },
  lastAppliedDuplicatePrefill: string | null,
): boolean {
  if (focusVisitIndex === 0) {
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
