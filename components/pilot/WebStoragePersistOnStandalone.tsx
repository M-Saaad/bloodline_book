import { useEffect } from 'react';
import { Platform } from 'react-native';

import { requestWebStoragePersistOnce } from '@/lib/pilot/web-storage-persist';

export function WebStoragePersistOnStandalone() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      void requestWebStoragePersistOnce();
    }
  }, []);

  return null;
}
