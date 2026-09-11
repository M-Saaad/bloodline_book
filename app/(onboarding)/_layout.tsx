import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: 'Setup',
        headerStyle: { backgroundColor: '#fdf4f3' },
        headerTintColor: '#752c26',
      }}>
      <Stack.Screen name="create-farm" options={{ title: 'Create Farm' }} />
    </Stack>
  );
}
