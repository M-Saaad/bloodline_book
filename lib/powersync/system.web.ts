import { PowerSyncDatabase } from '@powersync/web';

import { SupabaseConnector } from '@/lib/powersync/connector';
import { AppSchema } from '@/lib/powersync/schema';

const WORKER_PATH = '/@powersync/worker.js';

export const connector = new SupabaseConnector();

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'bloodline.db',
    worker: WORKER_PATH,
    disableSSRWarning: true,
  },
  sync: {
    worker: WORKER_PATH,
  },
});

export async function initPowerSync(): Promise<void> {
  await powersync.init();
  await powersync.connect(connector);
}

export async function disconnectPowerSync(): Promise<void> {
  await powersync.disconnect();
}
