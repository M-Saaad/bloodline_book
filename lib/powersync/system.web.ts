import { PowerSyncDatabase } from '@powersync/web';

import { SupabaseConnector } from '@/lib/powersync/connector';
import { AppSchema } from '@/lib/powersync/schema';
import {
  getPowerSyncWorkerUrl,
  inspectWebRuntime,
  POWER_SYNC_WEB_WORKER_PATH,
  resolvePowerSyncWebFlags,
} from '@/lib/powersync/web-runtime';

const runtime = inspectWebRuntime();
const webFlags = resolvePowerSyncWebFlags(runtime);

if (!webFlags.useWebWorker) {
  console.info(
    '[PowerSync] Using main-thread SQLite (Agent/embedded preview). Workers stay enabled on VM Chrome and Vercel.',
  );
}

function workerScriptUrl(): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : undefined;
  return getPowerSyncWorkerUrl(origin, POWER_SYNC_WEB_WORKER_PATH);
}

function createDatabaseWorker(options: {
  flags?: { enableMultiTabs?: boolean };
  dbFilename?: string;
}): Worker | SharedWorker {
  const url = workerScriptUrl();
  const name = options.dbFilename ?? 'bloodline.db';
  if (options.flags?.enableMultiTabs && typeof SharedWorker !== 'undefined') {
    return new SharedWorker(url, {
      name: `shared-DB-worker-${name}`,
      type: 'module',
    });
  }
  return new Worker(url, {
    name: `DB-worker-${name}`,
    type: 'module',
  });
}

export const connector = new SupabaseConnector();

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'bloodline.db',
    worker: createDatabaseWorker,
    disableSSRWarning: true,
    enableMultiTabs: webFlags.enableMultiTabs,
    useWebWorker: webFlags.useWebWorker,
  },
  sync: {
    worker: () =>
      new SharedWorker(workerScriptUrl(), {
        name: 'shared-sync-bloodline.db',
        type: 'module',
      }),
  },
});

export async function preparePowerSync(): Promise<void> {
  await powersync.init();
}

export async function connectPowerSyncBackend(): Promise<void> {
  await powersync.connect(connector);
}

export async function initPowerSync(): Promise<void> {
  await preparePowerSync();
  await connectPowerSyncBackend();
}

export async function disconnectPowerSync(): Promise<void> {
  await powersync.disconnect();
}

/** Wipes local replica (IndexedDB on web) and reconnects. Use after sign-out or stale sync. */
export async function disconnectAndClearPowerSync(): Promise<void> {
  await powersync.disconnectAndClear();
}

export async function reconnectPowerSync(): Promise<void> {
  await powersync.disconnectAndClear();
  await preparePowerSync();
  await connectPowerSyncBackend();
}
