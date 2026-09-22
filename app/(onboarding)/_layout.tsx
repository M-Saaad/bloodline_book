import { Stack } from 'expo-router';

import { RequireAuth } from '@/components/RequireAuth';

export default function OnboardingLayout() {
  return (
    <RequireAuth>
    <Stack
      screenOptions={{
        headerShown: true,
        title: 'Setup',
        headerStyle: { backgroundColor: '#fdf4f3' },
        headerTintColor: '#752c26',
      }}>
      <Stack.Screen name="create-farm" options={{ title: 'Create Farm' }} />
    </Stack>
    </RequireAuth>
  );
}
