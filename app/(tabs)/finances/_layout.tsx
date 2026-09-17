import { Stack } from 'expo-router';

export default function FinancesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fdf4f3' },
        headerTintColor: '#752c26',
        headerTitleStyle: { fontWeight: '600' },
      }}>
      <Stack.Screen name="index" options={{ title: 'Finances' }} />
      <Stack.Screen name="add" options={{ title: 'Add Transaction' }} />
    </Stack>
  );
}
