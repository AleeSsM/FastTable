import { Stack } from 'expo-router';

import { AcColors } from '@/constants/alacarta';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: AcColors.surfaceElevated },
        headerTintColor: AcColors.accentText,
        headerTitleStyle: { fontWeight: '700', color: AcColors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: AcColors.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Administración', headerShown: false }} />
      <Stack.Screen name="personal" options={{ title: 'Personal' }} />
      <Stack.Screen name="mesas" options={{ title: 'Mesas' }} />
      <Stack.Screen name="ingredientes" options={{ title: 'Ingredientes' }} />
      <Stack.Screen name="platillos" options={{ title: 'Platillos' }} />
    </Stack>
  );
}
