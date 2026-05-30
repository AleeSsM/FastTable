import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { AuthBoot } from '@/components/auth-boot';
import { SoloPersonalWeb } from '@/components/solo-personal-web';
import { useAuth } from '@/contexts/auth-context';
import { Comensal } from '@/constants/theme-comensal';
import { useNavigateToWelcomeOnceWhen, useNavigateToWorkerWhen } from '@/hooks/use-auth-navigation';

export default function GuestTabLayout() {
  const { session, staffMember, loading, signingOut } = useAuth();

  const needsWorker = !loading && !signingOut && !!session && !!staffMember;
  const needsHome = !signingOut && !loading && !session;

  useNavigateToWelcomeOnceWhen(needsHome);
  useNavigateToWorkerWhen(needsWorker);

  // Sin sesión no montar tabs. Personal → worker antes de pintar tabs.
  if (signingOut || !session || needsWorker) {
    return <AuthBoot />;
  }

  // La versión web es exclusiva para personal; los clientes usan la app móvil.
  if (Platform.OS === 'web') {
    return <SoloPersonalWeb />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Comensal.surface },
        headerTitleStyle: {
          color: Comensal.text,
          fontWeight: '700',
          fontSize: 18,
          letterSpacing: 0.35,
        },
        headerShadowVisible: false,
        headerTintColor: Comensal.accent,
        tabBarActiveTintColor: Comensal.accent,
        tabBarInactiveTintColor: Comensal.textFaint,
        tabBarStyle: {
          backgroundColor: Comensal.surfaceElevated,
          borderTopWidth: 1,
          borderTopColor: Comensal.border,
          height: 66,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mesas',
          tabBarLabel: 'Mesas',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Fila',
          tabBarLabel: 'Fila',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menú',
          tabBarLabel: 'Menú',
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="service"
        options={{
          title: 'Servicio',
          tabBarLabel: 'Servicio',
          tabBarIcon: ({ color, size }) => <Ionicons name="hand-left-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Más',
          tabBarLabel: 'Más',
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
