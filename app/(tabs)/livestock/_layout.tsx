import { Stack } from 'expo-router';

export default function LivestockLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fdf4f3' },
        headerTintColor: '#752c26',
        headerTitleStyle: { fontWeight: '600' },
      }}>
      <Stack.Screen name="index" options={{ title: 'Livestock' }} />
      <Stack.Screen name="add" options={{ title: 'Add Animal' }} />
      <Stack.Screen name="weight" options={{ title: 'Weigh Day' }} />
      <Stack.Screen name="[id]" options={{ title: 'Animal' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit Animal' }} />
    </Stack>
  );
}
