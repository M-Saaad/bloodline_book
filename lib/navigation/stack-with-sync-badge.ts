import { syncBadgeHeaderRight } from '@/components/SyncBadge';
import { useTextScale } from '@/lib/store/text-size';

const HEADER_TITLE_SIZE = 20;

/** Stack header options; the title follows the "Text size" setting. */
export function useStackWithSyncBadge() {
  const scale = useTextScale();
  return {
    headerStyle: { backgroundColor: '#f6f2ee' },
    headerTintColor: '#5e1a0e',
    headerTitleStyle: {
      fontWeight: '800' as const,
      fontSize: Math.round(HEADER_TITLE_SIZE * scale),
    },
    headerShadowVisible: false,
    headerBackTitle: 'Back',
    headerRight: syncBadgeHeaderRight(),
  };
}
