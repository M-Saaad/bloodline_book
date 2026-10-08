import { Stack } from 'expo-router';

import { RedirectIfSignedIn } from '@/components/RedirectIfSignedIn';

export default function AuthLayout() {
  return (
    <RedirectIfSignedIn>
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#f6f2ee' },
        headerTintColor: '#5e1a0e',
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
        headerShadowVisible: false,
      }}>
      <Stack.Screen name="sign-in" options={{ title: 'Sign In', headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
      <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
    </Stack>
    </RedirectIfSignedIn>
  );
}
