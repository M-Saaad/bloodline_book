export const POWER_SYNC_WEB_WORKER_PATH = '/powersync/worker.js';

export type WebRuntimeSnapshot = {
  hasWindow: boolean;
  isIframe: boolean;
  hasSharedWorker: boolean;
  hasDedicatedWorker: boolean;
  hasWebLocks: boolean;
  isSecureContext: boolean;
};

export type PowerSyncWebFlags = {
  enableMultiTabs: boolean;
  useWebWorker: boolean;
};

/**
 * Cursor Agent (and other proxied previews) load Expo web in a cross-origin
 * iframe. SharedWorkers often never connect there, so PowerSync init hangs and
 * `useQuery` stays on "Loading herd stats…". Dedicated workers + a path without
 * `/@` remain compatible with Vercel production.
 */
export function inspectWebRuntime(
  globalObject: typeof globalThis = globalThis,
): WebRuntimeSnapshot {
  const win = (globalObject as typeof globalThis & { window?: Window }).window;
  const nav = globalObject.navigator as Navigator | undefined;
  const hasWindow = typeof win !== 'undefined' && win != null;

  let isIframe = false;
  if (hasWindow) {
    try {
      isIframe = win.parent !== win;
    } catch {
      isIframe = true;
    }
  }

  return {
    hasWindow,
    isIframe,
    hasSharedWorker: typeof (globalObject as { SharedWorker?: unknown }).SharedWorker ===
      'function',
    hasDedicatedWorker: typeof (globalObject as { Worker?: unknown }).Worker === 'function',
    hasWebLocks: Boolean(nav && 'locks' in nav && nav.locks),
    isSecureContext: hasWindow ? win.isSecureContext !== false : false,
  };
}

export function resolvePowerSyncWebFlags(
  runtime: WebRuntimeSnapshot = inspectWebRuntime(),
): PowerSyncWebFlags {
  const canUseLocks = runtime.hasWebLocks && runtime.isSecureContext;
  const enableMultiTabs =
    canUseLocks &&
    runtime.hasSharedWorker &&
    !runtime.isIframe;
  const useWebWorker = canUseLocks && runtime.hasDedicatedWorker;

  return { enableMultiTabs, useWebWorker };
}

export function getPowerSyncWorkerUrl(
  origin?: string,
  path: string = POWER_SYNC_WEB_WORKER_PATH,
): string {
  if (origin && origin.length > 0) {
    return new URL(path, origin).toString();
  }
  return path;
}
