import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fdf4f3' },
        headerTintColor: '#752c26',
        headerTitleStyle: { fontWeight: '600' },
      }}>
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="team" options={{ title: 'Team' }} />
      <Stack.Screen name="documents" options={{ headerShown: false }} />
      <Stack.Screen name="tasks" options={{ headerShown: false }} />
    </Stack>
  );
}
