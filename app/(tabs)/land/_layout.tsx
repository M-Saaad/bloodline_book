import { Stack } from 'expo-router';

export default function LandLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fdf4f3' },
        headerTintColor: '#752c26',
        headerTitleStyle: { fontWeight: '600' },
      }}>
      <Stack.Screen name="index" options={{ title: 'Land' }} />
      <Stack.Screen name="add-pasture" options={{ title: 'Add Pasture' }} />
      <Stack.Screen name="add-grazing" options={{ title: 'Move Animals' }} />
      <Stack.Screen name="add-feed" options={{ title: 'Log Feed' }} />
      <Stack.Screen name="[id]" options={{ title: 'Pasture' }} />
    </Stack>
  );
}
