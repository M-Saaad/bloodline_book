import { PowerSyncDatabase } from '@powersync/react-native';

import { SupabaseConnector } from '@/lib/powersync/connector';
import { AppSchema } from '@/lib/powersync/schema';

export const connector = new SupabaseConnector();

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'bloodline.db',
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

export async function disconnectAndClearPowerSync(): Promise<void> {
  await powersync.disconnectAndClear();
}

export async function reconnectPowerSync(): Promise<void> {
  await powersync.disconnectAndClear();
  await preparePowerSync();
  await connectPowerSyncBackend();
}
