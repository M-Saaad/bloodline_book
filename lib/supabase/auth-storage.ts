export type AuthStorageKind = 'async-storage' | 'memory';

/**
 * Native bundles evaluate this module before React Native assigns `window`.
 * A `typeof window` check at that moment picks storage that drops every write,
 * so the session is gone after the process is killed.
 * Web SSR still has no persistent storage, so it keeps the memory adapter.
 */
export function selectAuthStorageKind(
  platformOS: string,
  windowDefined: boolean,
): AuthStorageKind {
  if (platformOS === 'web' && !windowDefined) {
    return 'memory';
  }
  return 'async-storage';
}
