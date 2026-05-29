import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WorkerWebShell } from '@/components/web/worker-web-shell';

/**
 * Layout del personal SOLO para web. Reemplaza al Stack móvil por un marco de
 * escritorio (barra lateral + contenido). El móvil sigue usando `_layout.tsx`.
 */
export default function WorkerWebLayout() {
  return (
    <SafeAreaProvider>
      <WorkerWebShell>
        <Slot />
      </WorkerWebShell>
    </SafeAreaProvider>
  );
}
