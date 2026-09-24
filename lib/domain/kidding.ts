export type KiddingEase = 'unassisted' | 'assisted' | 'vet';
export type KidOutcome = 'alive' | 'dead';

export function aliveKidCount(rows: { outcome: KidOutcome }[]): number {
  return rows.filter((row) => row.outcome === 'alive').length;
}

export function litterSizeWord(born: number): string {
  switch (born) {
    case 1:
      return 'Single';
    case 2:
      return 'Twin';
    case 3:
      return 'Triplet';
    case 4:
      return 'Quad';
    default:
      return `${born} kids`;
  }
}

export function litterSummaryLabel(born: number, alive: number): string {
  return `${litterSizeWord(born)} (${born} born, ${alive} alive)`;
}

export function kidInheritsBreed(
  damBreedId: string | null,
  sireBreedId: string | null,
): string | null {
  if (!damBreedId) {
    return null;
  }
  if (!sireBreedId || sireBreedId === damBreedId) {
    return damBreedId;
  }
  return null;
}

export function weaningTaskTitle(doeLabel: string): string {
  return `Wean — ${doeLabel}'s kids`;
}

export function parseBirthWeight(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    return 'invalid';
  }
  return value;
}
