import { Stack } from 'expo-router';

import { FtColors } from '@/constants/fasttable';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: FtColors.surfaceElevated },
        headerTintColor: FtColors.accentText,
        headerTitleStyle: { fontWeight: '700', color: FtColors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: FtColors.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Administración', headerShown: false }} />
      <Stack.Screen name="personal" options={{ title: 'Personal' }} />
      <Stack.Screen name="mesas" options={{ title: 'Mesas' }} />
      <Stack.Screen name="ingredientes" options={{ title: 'Ingredientes' }} />
      <Stack.Screen name="platillos" options={{ title: 'Platillos' }} />
    </Stack>
  );
}
