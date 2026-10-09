import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useTextSizeStore } from '@/lib/store/text-size';

/**
 * Web only: the web build is styled with CSS classes, so the "Text size"
 * setting zooms the page instead (like the browser's own zoom). Renders
 * nothing; on the phone apps it does nothing at all.
 */
export function WebTextZoom() {
  const scale = useTextSizeStore((state) => state.scale);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    document.documentElement.style.zoom = scale === 1 ? '' : String(scale);
  }, [scale]);

  return null;
}
