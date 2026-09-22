import { Stack } from 'expo-router';

import { RedirectIfSignedIn } from '@/components/RedirectIfSignedIn';

export default function AuthLayout() {
  return (
    <RedirectIfSignedIn>
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#fdf4f3' },
        headerTintColor: '#752c26',
        headerTitleStyle: { fontWeight: '600' },
      }}>
      <Stack.Screen name="sign-in" options={{ title: 'Sign In' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create Account' }} />
    </Stack>
    </RedirectIfSignedIn>
  );
}
