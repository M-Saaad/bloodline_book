import { useStatus } from '@powersync/react';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { powersync } from '@/lib/powersync/system';

const LEAVE_MESSAGE =
  'Changes are still saving. Wait until All saved before closing the app.';

export function WebUploadQueueWarning() {
  const status = useStatus();
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    let cancelled = false;

    async function refreshQueue() {
      try {
        const stats = await powersync.getUploadQueueStats();
        if (!cancelled) {
          setQueueCount(stats.count);
        }
      } catch {
        // Keep last count while offline.
      }
    }

    void refreshQueue();
    const interval = setInterval(() => {
      void refreshQueue();
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status.uploading, status.connected]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const shouldWarn = () => queueCount > 0;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldWarn()) {
        return;
      }
      event.preventDefault();
      event.returnValue = LEAVE_MESSAGE;
    };

    const onPageHide = (event: PageTransitionEvent) => {
      if (!shouldWarn()) {
        return;
      }
      if (!event.persisted) {
        event.preventDefault();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [queueCount]);

  return null;
}
