import { syncBadgeHeaderRight } from '@/components/SyncBadge';

export const stackWithSyncBadge = {
  headerStyle: { backgroundColor: '#f6f2ee' },
  headerTintColor: '#5e1a0e',
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 20 },
  headerShadowVisible: false,
  headerBackTitle: 'Back',
  headerRight: syncBadgeHeaderRight(),
};
