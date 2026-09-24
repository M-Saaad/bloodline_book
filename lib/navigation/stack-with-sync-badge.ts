import { syncBadgeHeaderRight } from '@/components/SyncBadge';

export const stackWithSyncBadge = {
  headerStyle: { backgroundColor: '#fdf4f3' },
  headerTintColor: '#752c26',
  headerTitleStyle: { fontWeight: '600' as const },
  headerRight: syncBadgeHeaderRight(),
};
