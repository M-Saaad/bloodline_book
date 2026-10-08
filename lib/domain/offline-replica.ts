export type ReplicaLoadingInput = {
  /** True after this device has completed a sync at least once. Undefined while unknown. */
  hasSynced: boolean | undefined;
  localRowCount: number;
  /** True until the local database read has returned. */
  localQueryLoading: boolean;
  /**
   * Brand-new install only: a server lookup for an empty local replica is still
   * running. Ignored once this device has synced.
   */
  emptyBootstrapPending?: boolean;
};

/**
 * Full-screen loading is only for a brand-new install that has never finished
 * a sync and does not yet have local rows.
 * A device that has synced before shows the local database immediately, including
 * while sync is offline or the current sync has not finished.
 */
export function shouldShowReplicaLoading(input: ReplicaLoadingInput): boolean {
  if (input.localRowCount > 0) {
    return false;
  }
  if (input.hasSynced === true) {
    return false;
  }
  if (input.localQueryLoading) {
    return true;
  }
  return input.emptyBootstrapPending === true;
}

/** Do not send a farmer to create a farm before the local farm read has answered. */
export function shouldRouteToCreateFarm(input: {
  localFarmsResolved: boolean;
  farmCount: number;
  hasActiveFarm: boolean;
}): boolean {
  if (!input.localFarmsResolved) {
    return false;
  }
  return input.farmCount === 0 && !input.hasActiveFarm;
}

/** Prefer rows already returned by the watched query, otherwise a direct local read. */
export function preferLocalRows<T>(
  queryRows: readonly T[],
  localRows: readonly T[] | null,
): T[] {
  if (queryRows.length > 0) {
    return [...queryRows];
  }
  if (localRows && localRows.length > 0) {
    return [...localRows];
  }
  return [...queryRows];
}
