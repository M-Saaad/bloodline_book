import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { RequireAuth } from '@/components/RequireAuth';
import { syncBadgeHeaderRight } from '@/components/SyncBadge';

function TabIcon({ label }: { label: string }) {
  // className on a tab icon is drawn twice by NativeWind's style interop.
  return <Text style={{ fontSize: 18, lineHeight: 22 }}>{label}</Text>;
}

export default function TabLayout() {
  return (
    <RequireAuth>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ca4034',
        tabBarInactiveTintColor: '#6b7280',
        headerStyle: { backgroundColor: '#fdf4f3' },
        headerTintColor: '#752c26',
        headerTitleStyle: { fontWeight: '600' },
        headerRight: syncBadgeHeaderRight(),
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Today',
          tabBarIcon: () => <TabIcon label="🏠" />,
        }}
      />
      <Tabs.Screen
        name="livestock"
        options={{
          title: 'Livestock',
          headerShown: false,
          tabBarIcon: () => <TabIcon label="🐐" />,
        }}
      />
      <Tabs.Screen
        name="land"
        options={{
          title: 'Land',
          headerShown: false,
          tabBarIcon: () => <TabIcon label="🌾" />,
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Finances',
          headerShown: false,
          tabBarIcon: () => <TabIcon label="💰" />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          headerShown: false,
          tabBarIcon: () => <TabIcon label="⋯" />,
        }}
      />
    </Tabs>
    </RequireAuth>
  );
}
