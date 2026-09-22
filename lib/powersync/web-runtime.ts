export const POWER_SYNC_WEB_WORKER_PATH = '/powersync/worker.js';

export type WebRuntimeSnapshot = {
  hasWindow: boolean;
  isIframe: boolean;
  isEmbeddedBrowser: boolean;
  hostname: string;
  hasSharedWorker: boolean;
  hasDedicatedWorker: boolean;
  hasWebLocks: boolean;
  isSecureContext: boolean;
};

export type PowerSyncWebFlags = {
  enableMultiTabs: boolean;
  useWebWorker: boolean;
};

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

/**
 * VM browser: desktop Chrome on the agent VM at http://localhost:8081.
 * Agent browser: Cursor's embedded preview (Electron webview) of the same
 * forwarded port. Shared/module workers often never connect there, so
 * PowerSync init hangs and screens stay on "Loading herd stats…".
 */
export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

export function isFirstPartyStaticHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.endsWith('.vercel.app') || host.endsWith('.vercel.sh');
}

export function isEmbeddedBrowserUserAgent(userAgent: string): boolean {
  return /Electron|Cursor\/|VSCode|Code\/\d/i.test(userAgent);
}

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

  const hostname = hasWindow ? win.location.hostname : '';
  const userAgent = nav?.userAgent ?? '';

  return {
    hasWindow,
    isIframe,
    isEmbeddedBrowser: isEmbeddedBrowserUserAgent(userAgent),
    hostname,
    hasSharedWorker: typeof (globalObject as { SharedWorker?: unknown }).SharedWorker ===
      'function',
    hasDedicatedWorker: typeof (globalObject as { Worker?: unknown }).Worker === 'function',
    hasWebLocks: Boolean(nav && 'locks' in nav && nav.locks),
    isSecureContext: hasWindow ? win.isSecureContext !== false : false,
  };
}

export function isPowerSyncWebWorkerSafe(runtime: WebRuntimeSnapshot): boolean {
  if (!runtime.hasWindow || runtime.isIframe || runtime.isEmbeddedBrowser) {
    return false;
  }
  return (
    isLoopbackHostname(runtime.hostname) ||
    isFirstPartyStaticHostname(runtime.hostname)
  );
}

export function resolvePowerSyncWebFlags(
  runtime: WebRuntimeSnapshot = inspectWebRuntime(),
): PowerSyncWebFlags {
  const canUseLocks = runtime.hasWebLocks && runtime.isSecureContext;
  const workerSafe = canUseLocks && isPowerSyncWebWorkerSafe(runtime);
  const useWebWorker = workerSafe && runtime.hasDedicatedWorker;
  const enableMultiTabs = useWebWorker && runtime.hasSharedWorker;

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
