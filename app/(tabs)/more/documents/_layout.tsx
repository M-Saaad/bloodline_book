import { Stack } from 'expo-router';

export default function DocumentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#f6f2ee' },
        headerTintColor: '#5e1a0e',
        headerTitleStyle: { fontWeight: '600' },
      }}>
      <Stack.Screen name="index" options={{ title: 'Documents' }} />
      <Stack.Screen name="add" options={{ title: 'Add Document' }} />
    </Stack>
  );
}
