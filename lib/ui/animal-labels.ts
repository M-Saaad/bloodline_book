import type { Animal } from '@/lib/types/animals';

export const UNNAMED_ANIMAL_LABEL = 'Unnamed animal';

type AnimalLabelSource = {
  name?: string | null;
  tagNumber?: string | null;
  officialId?: string | null;
  id?: string | null;
};

/**
 * Name, then farm tag (`#tag`), then official ID as stored (scrapie or USDA),
 * then "Unnamed animal".
 */
export function animalDisplayLabel(animal: AnimalLabelSource): string {
  const name = animal.name?.trim();
  if (name) {
    return name;
  }
  const tag = animal.tagNumber?.trim();
  if (tag) {
    return `#${tag}`;
  }
  const officialId = animal.officialId?.trim();
  if (officialId) {
    return officialId;
  }
  return UNNAMED_ANIMAL_LABEL;
}

/** Split a title so the farm tag can be painted separately from the name. */
export function animalTitleParts(animal: AnimalLabelSource): {
  primary: string;
  tag: string | null;
} {
  const name = animal.name?.trim() ?? '';
  const tag = animal.tagNumber?.trim() ?? '';
  if (name) {
    return { primary: name, tag: tag ? `#${tag}` : null };
  }
  if (tag) {
    return { primary: '', tag: `#${tag}` };
  }
  return { primary: animalDisplayLabel(animal), tag: null };
}

export function formatSex(sex: Animal['sex']): string {
  switch (sex) {
    case 'female':
      return 'Doe';
    case 'male':
      return 'Buck';
    default: {
      const _exhaustive: never = sex;
      return _exhaustive;
    }
  }
}

export function formatLifecycleStage(stage: Animal['lifecycleStage']): string {
  return stage.replace(/_/g, ' ');
}

export function formatAnimalStatus(status: Animal['status']): string {
  switch (status) {
    case 'died':
      return 'dead';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function formatRegistrationBody(
  body: Animal['registrationBody'],
): string | null {
  if (!body) {
    return null;
  }
  switch (body) {
    case 'adga':
      return 'ADGA';
    case 'abga':
      return 'ABGA';
    case 'usbga':
      return 'USBGA';
    case 'other':
      return 'Other';
    default: {
      const _exhaustive: never = body;
      return _exhaustive;
    }
  }
}

export function statusBadgeTone(
  status: Animal['status'],
): 'default' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'active':
      return 'success';
    case 'sold':
      return 'warning';
    case 'died':
    case 'slaughtered':
      return 'danger';
    case 'transferred':
      return 'default';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
