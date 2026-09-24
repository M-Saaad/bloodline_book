export type AnimalDeleteBlocker =
  | 'breeding'
  | 'kidding'
  | 'offspring';

export function animalDeleteBlockedMessage(
  blockers: AnimalDeleteBlocker[],
): string {
  if (blockers.includes('breeding')) {
    return 'This goat has breeding records — mark her Sold or Dead instead.';
  }
  if (blockers.includes('kidding')) {
    return 'This goat has kidding records — mark her Sold or Dead instead.';
  }
  if (blockers.includes('offspring')) {
    return 'This goat is listed as a parent on other animals — mark her Sold or Dead instead.';
  }
  return 'This goat cannot be deleted.';
}

export function formatAnimalDeletePreview(input: {
  weightCount: number;
  healthCount: number;
  grazingCount: number;
}): string {
  const parts: string[] = [];
  if (input.weightCount > 0) {
    parts.push(
      `${input.weightCount} weight ${input.weightCount === 1 ? 'entry' : 'entries'}`,
    );
  }
  if (input.healthCount > 0) {
    parts.push(
      `${input.healthCount} health ${input.healthCount === 1 ? 'record' : 'records'}`,
    );
  }
  if (input.grazingCount > 0) {
    parts.push(
      `${input.grazingCount} grazing ${input.grazingCount === 1 ? 'stay' : 'stays'}`,
    );
  }
  if (parts.length === 0) {
    return 'This will permanently remove this goat from your herd.';
  }
  return `This will also delete ${parts.join(', ')} for this goat.`;
}
