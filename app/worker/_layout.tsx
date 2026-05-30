import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WorkerAuthGate } from '@/components/worker-auth-gate';
import { FtColors } from '@/constants/fasttable';

export default function WorkerLayout() {
  return (
    <SafeAreaProvider>
    <WorkerAuthGate>
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: FtColors.surfaceElevated },
        headerTintColor: FtColors.accentText,
        headerTitleStyle: { fontWeight: '700', color: FtColors.text },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: FtColors.background,
          ...(Platform.OS === 'web'
            ? { maxWidth: 1100, width: '100%', alignSelf: 'center' as const }
            : null),
        },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="reservations" options={{ title: 'Reservas y mesas' }} />
      <Stack.Screen name="kitchen" options={{ title: 'Cocina', headerShown: false }} />
      <Stack.Screen name="gerente" options={{ title: 'Gerencia', headerShown: false }} />
      <Stack.Screen name="inventario" options={{ title: 'Inventario' }} />
      <Stack.Screen name="mesa-pedidos" options={{ title: 'Pedidos de mesa' }} />
      <Stack.Screen name="servicios-cerrados" options={{ title: 'Recibos de servicio' }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
    </WorkerAuthGate>
    </SafeAreaProvider>
  );
}
