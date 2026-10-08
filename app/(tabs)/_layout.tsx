import { router, Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/BottomNav';
import { RequireAuth } from '@/components/RequireAuth';
import { syncBadgeHeaderRight } from '@/components/SyncBadge';
import {
  currentNestedRouteName,
  tabPressShouldOpenRoot,
} from '@/lib/navigation/more-tab';

function TabIcon({ label }: { label: string }) {
  // className on a tab icon is drawn twice by NativeWind's style interop.
  return <Text style={{ fontSize: 18, lineHeight: 22 }}>{label}</Text>;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const webTabBarStyle =
    Platform.OS === 'web'
      ? { paddingBottom: Math.max(insets.bottom, 8) }
      : undefined;

  return (
    <RequireAuth>
    <Tabs
      tabBar={() => <BottomNav />}
      screenOptions={{
        tabBarActiveTintColor: '#a52f1a',
        tabBarInactiveTintColor: '#5a4b46',
        headerStyle: { backgroundColor: '#f6f2ee' },
        headerTintColor: '#5e1a0e',
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
        headerShadowVisible: false,
        headerRight: syncBadgeHeaderRight(),
        tabBarStyle: webTabBarStyle,
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
          title: 'Herd',
          headerShown: false,
          tabBarIcon: () => <TabIcon label="🐐" />,
        }}
      />
      <Tabs.Screen
        name="land"
        options={{
          title: 'Land',
          href: null,
          headerShown: false,
          tabBarIcon: () => <TabIcon label="🌾" />,
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Money',
          href: null,
          headerShown: false,
          tabBarIcon: () => <TabIcon label="💰" />,
        }}
      />
      <Tabs.Screen
        name="more"
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            const routeName = currentNestedRouteName(
              navigation.getState().routes,
              'more',
            );
            if (!tabPressShouldOpenRoot(routeName)) {
              return;
            }
            event.preventDefault();
            router.navigate('/more');
          },
        })}
        options={{
          title: 'More',
          headerShown: false,
          popToTopOnBlur: true,
          tabBarIcon: () => <TabIcon label="⋯" />,
        }}
      />
    </Tabs>
    </RequireAuth>
  );
}
