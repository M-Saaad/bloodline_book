import {
  WEB_STORAGE_PERSIST_FLAG_KEY,
  isStandaloneWebApp,
} from '@/lib/pilot/ios-web';

/**
 * Ask the browser to keep the herd database when storage is tight.
 * Runs once per device after the app is opened from the home screen.
 */
export async function requestWebStoragePersistOnce(): Promise<void> {
  if (typeof window === 'undefined' || !isStandaloneWebApp()) {
    return;
  }
  try {
    const already = window.localStorage.getItem(WEB_STORAGE_PERSIST_FLAG_KEY);
    if (already === '1') {
      return;
    }
    const storage = navigator.storage;
    if (!storage?.persist) {
      return;
    }
    await storage.persist();
    window.localStorage.setItem(WEB_STORAGE_PERSIST_FLAG_KEY, '1');
  } catch {
    // Best effort only.
  }
}
