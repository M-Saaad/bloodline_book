import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

import { attachSheetBack, type SheetBackHost } from '@/lib/navigation/sheet-back';

/**
 * While `active`, Back closes this sheet and stays on the current screen.
 * Web pushes one same-URL history entry for the browser Back button.
 * Android uses the hardware back key when Modal does not already consume it.
 */
export function useCloseOnBack(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) {
      return;
    }
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') {
        return;
      }
      return attachSheetBack(() => onCloseRef.current(), window as unknown as SheetBackHost);
    }
    if (Platform.OS !== 'android') {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [active]);
}
