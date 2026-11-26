import { Platform } from 'react-native';

export type TabLayoutBackBehavior =
  | 'firstRoute'
  | 'initialRoute'
  | 'order'
  | 'history'
  | 'fullHistory'
  | 'none';

/**
 * Tab navigator back behavior: return to the last visited tab, not the first
 * (Today). On web/PWA, fullHistory keeps browser back aligned with tab visits.
 */
export function tabLayoutBackBehavior(): TabLayoutBackBehavior {
  return Platform.OS === 'web' ? 'fullHistory' : 'history';
}