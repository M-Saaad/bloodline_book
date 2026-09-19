import { Stack } from 'expo-router';

export default function DocumentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fdf4f3' },
        headerTintColor: '#752c26',
        headerTitleStyle: { fontWeight: '600' },
      }}>
      <Stack.Screen name="index" options={{ title: 'Documents' }} />
      <Stack.Screen name="add" options={{ title: 'Add Document' }} />
    </Stack>
  );
}
