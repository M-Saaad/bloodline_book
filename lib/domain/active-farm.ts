export type RememberedFarm = {
  userId: string;
  farmId: string;
};

/** Storage holds `{ userId, farmId }`. A bare id from an older build is ignored. */
export function parseRememberedFarm(raw: string | null): RememberedFarm | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<RememberedFarm>;
    if (
      typeof parsed.userId === 'string' &&
      parsed.userId.length > 0 &&
      typeof parsed.farmId === 'string' &&
      parsed.farmId.length > 0
    ) {
      return { userId: parsed.userId, farmId: parsed.farmId };
    }
  } catch {
    return null;
  }
  return null;
}

/** Saved choice counts only for the user who made it. */
export function savedFarmIdForUser(
  remembered: RememberedFarm | null,
  userId: string | null,
): string | null {
  if (!remembered || !userId || remembered.userId !== userId) {
    return null;
  }
  return remembered.farmId;
}

/**
 * Keep the preferred farm when this user still belongs to it.
 * With no preference, or a farm they no longer belong to, use the first farm
 * in the already-sorted list (name order, same as today).
 * An empty list keeps the preference so a slow local read does not wipe it.
 */
export function resolveActiveFarmId(input: {
  farms: readonly { id: string }[];
  preferredFarmId: string | null;
}): string | null {
  if (input.farms.length === 0) {
    return input.preferredFarmId;
  }
  if (
    input.preferredFarmId &&
    input.farms.some((farm) => farm.id === input.preferredFarmId)
  ) {
    return input.preferredFarmId;
  }
  return input.farms[0].id;
}

/** One farm stays a static card. Two or more can be switched. */
export function canSwitchFarm(farmCount: number): boolean {
  return farmCount >= 2;
}
