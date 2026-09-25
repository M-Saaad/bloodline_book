export type SyncBadgeState =
  | { kind: 'all_saved'; label: 'All saved' }
  | { kind: 'saving'; label: 'Saving…' }
  | { kind: 'offline_waiting'; label: string; count: number }
  | { kind: 'not_saved'; label: string; count: number };

export type DeviceNetworkSnapshot = {
  isConnected?: boolean;
  isInternetReachable?: boolean;
  type?: string;
};

/**
 * Whether this phone has a usable signal.
 * `null` means the network state has not loaded yet.
 * Web reports type UNKNOWN while online, so UNKNOWN alone is not "offline".
 */
export function deviceHasSignal(
  state: DeviceNetworkSnapshot | null | undefined,
): boolean | null {
  if (!state) {
    return null;
  }
  if (
    state.isConnected == null &&
    state.isInternetReachable == null &&
    state.type == null
  ) {
    return null;
  }
  if (state.type === 'NONE') {
    return false;
  }
  if (state.isInternetReachable === false) {
    return false;
  }
  if (state.isConnected === false) {
    return false;
  }
  if (state.isConnected === true || state.isInternetReachable === true) {
    return true;
  }
  return null;
}

export function resolveSyncBadge(input: {
  failureCount: number;
  queueCount: number;
  connected: boolean;
  uploading: boolean;
  deviceOnline: boolean | null;
}): SyncBadgeState {
  if (input.failureCount > 0) {
    return {
      kind: 'not_saved',
      count: input.failureCount,
      label: `${input.failureCount} not saved`,
    };
  }

  const pending = Math.max(input.queueCount, input.uploading ? 1 : 0);
  const offline =
    input.deviceOnline === false ||
    (input.deviceOnline == null && input.connected === false);

  if (offline && pending > 0) {
    return {
      kind: 'offline_waiting',
      count: pending,
      label: `Offline · ${pending} waiting`,
    };
  }

  if (!offline && (input.uploading || input.queueCount > 0)) {
    return { kind: 'saving', label: 'Saving…' };
  }

  return { kind: 'all_saved', label: 'All saved' };
}
