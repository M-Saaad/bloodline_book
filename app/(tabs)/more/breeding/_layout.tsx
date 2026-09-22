import { Stack } from 'expo-router';

export default function BreedingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fdf4f3' },
        headerTintColor: '#752c26',
        headerTitleStyle: { fontWeight: '600' },
      }}>
      <Stack.Screen name="index" options={{ title: 'Breeding & Kidding' }} />
      <Stack.Screen name="add-breeding" options={{ title: 'Log Breeding' }} />
      <Stack.Screen name="add-kidding" options={{ title: 'Log Kidding' }} />
      <Stack.Screen name="calendar" options={{ title: 'Breeding Calendar' }} />
    </Stack>
  );
}
