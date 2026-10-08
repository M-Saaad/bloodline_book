import { Stack } from 'expo-router';

import { RequireAuth } from '@/components/RequireAuth';

export default function OnboardingLayout() {
  return (
    <RequireAuth>
    <Stack
      screenOptions={{
        headerShown: true,
        title: 'Setup',
        headerStyle: { backgroundColor: '#f6f2ee' },
        headerTintColor: '#5e1a0e',
      }}>
      <Stack.Screen name="create-farm" options={{ title: 'Create farm', headerShown: false }} />
    </Stack>
    </RequireAuth>
  );
}
