import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';

import { AuthBoot } from '@/components/auth-boot';
import { adminCardShadow, adminStyles } from '@/constants/worker-admin-styles';
import { FtColors } from '@/constants/fasttable';
import { useGerenteGuardNavigation } from '@/hooks/use-gerente-guard-navigation';

type HubItem = {
  href: Href;
  title: string;
  sub: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

const HUB: HubItem[] = [
  {
    href: '/worker/admin/personal' as Href,
    title: 'Personal',
    sub: 'Da de alta, cambia el rol, activa o elimina a los miembros del equipo.',
    icon: 'people-outline',
  },
  {
    href: '/worker/admin/mesas' as Href,
    title: 'Mesas',
    sub: 'Crear, editar y eliminar mesas. Estados libre, ocupada o reservada.',
    icon: 'grid-outline',
  },
  {
    href: '/worker/admin/ingredientes' as Href,
    title: 'Ingredientes',
    sub: 'Catálogo de insumos para recetas y control de stock inicial.',
    icon: 'leaf-outline',
  },
  {
    href: '/worker/admin/platillos' as Href,
    title: 'Platillos',
    sub: 'Menú, precios, imágenes y recetas con ingredientes registrados.',
    icon: 'fast-food-outline',
  },
];

export default function AdminHubScreen() {
  const router = useRouter();
  const guard = useGerenteGuardNavigation();
  if (guard.boot === false || guard.redirectHref) {
    return <AuthBoot variant="worker" />;
  }

  return (
    <SafeAreaView style={adminStyles.safe} edges={['top', 'left', 'right']}>
      <ScrollView style={adminStyles.scroll} contentContainerStyle={adminStyles.content}>
        <Pressable style={adminStyles.backRow} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={FtColors.accent} />
          <Text style={adminStyles.backText}>Gerencia</Text>
        </Pressable>
        <View style={adminStyles.hero}>
          <Text style={adminStyles.heroEyebrow}>Configuración</Text>
          <Text style={adminStyles.heroTitle}>Administración</Text>
          <Text style={adminStyles.heroSub}>
            Gestiona mesas, ingredientes y platillos del restaurante. Los cambios se reflejan en tiempo real
            para el personal y comensales.
          </Text>
        </View>

        {HUB.map((item) => (
          <Pressable
            key={item.title}
            style={[adminStyles.hubCard, adminCardShadow]}
            onPress={() => router.push(item.href)}>
            <View style={adminStyles.hubIcon}>
              <Ionicons name={item.icon} size={24} color={FtColors.accent} />
            </View>
            <View style={adminStyles.hubMeta}>
              <Text style={adminStyles.hubTitle}>{item.title}</Text>
              <Text style={adminStyles.hubSub}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={FtColors.textMuted} />
          </Pressable>
        ))}

        <Pressable style={styles.inventarioLink} onPress={() => router.push('/worker/inventario')}>
          <Ionicons name="cube-outline" size={18} color={FtColors.accent} />
          <Text style={styles.inventarioLinkText}>Inventario operativo (entradas y ajustes)</Text>
          <Ionicons name="chevron-forward" size={18} color={FtColors.textMuted} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inventarioLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FtColors.border,
    backgroundColor: FtColors.surface,
  },
  inventarioLinkText: { flex: 1, fontSize: 14, fontWeight: '600', color: FtColors.text },
});
