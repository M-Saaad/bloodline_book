import { syncBadgeHeaderRight } from '@/components/SyncBadge';

export const stackWithSyncBadge = {
  headerStyle: { backgroundColor: '#f6f2ee' },
  headerTintColor: '#5e1a0e',
  headerTitleStyle: { fontWeight: '600' as const },
  headerRight: syncBadgeHeaderRight(),
};
