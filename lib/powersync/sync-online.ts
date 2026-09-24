import { powersync } from '@/lib/powersync/system';
import { isDeviceOnline } from '@/lib/network/online';

/** True when the browser/device reports offline, or PowerSync is not connected. */
export function isSyncUploadLikelyAvailable(): boolean {
  if (!isDeviceOnline()) {
    return false;
  }
  return powersync.currentStatus.connected === true;
}
