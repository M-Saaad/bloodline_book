import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/providers/AuthProvider';
import { useFarm } from '@/providers/FarmProvider';

const MENU_ITEMS = [
  { title: 'Health Log', route: '/(tabs)/more/health' as const },
  { title: 'Breeding & Kidding', route: '/(tabs)/more/breeding' as const },
  { title: 'Settings', route: '/(tabs)/more/settings' as const },
  { title: 'Team', route: '/(tabs)/more/team' as const },
  { title: 'Documents', route: '/(tabs)/more/documents' as const },
  { title: 'Tasks', route: '/(tabs)/more/tasks' as const },
];

export default function MoreScreen() {
  const { signOut } = useAuth();
  const { activeFarm } = useFarm();

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4 gap-4">
      {activeFarm && (
        <Card>
          <Text className="text-lg font-semibold text-gray-900 mb-1">
            {activeFarm.name}
          </Text>
          <Text className="text-gray-600 capitalize">
            {activeFarm.segment} · {activeFarm.currency} ·{' '}
            {activeFarm.weightUnit}
          </Text>
        </Card>
      )}

      <Card>
        {MENU_ITEMS.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route)}
            className="py-3 border-b border-gray-100 active:bg-gray-50">
            <Text className="text-base font-medium text-gray-900">
              {item.title}
            </Text>
          </Pressable>
        ))}
      </Card>

      <Button
        title="Sign Out"
        variant="outline"
        onPress={async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        }}
      />
    </ScrollView>
  );
}
