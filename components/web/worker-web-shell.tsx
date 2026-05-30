import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AcColors } from '@/constants/alacarta';
import { useAuth } from '@/contexts/auth-context';
import { useSafeSignOut } from '@/hooks/use-safe-sign-out';
import { badgeCountForItem, useWorkerNavBadges } from '@/hooks/use-worker-nav-badges';
import {
  navForRole,
  isNavItemActive,
  navItemHref,
  roleLabel,
  type WorkerNavItem,
  type WorkerRol,
} from '@/lib/worker-nav';

const SIDEBAR_WIDTH = 256;

/**
 * Marco de escritorio para el personal (solo web). Barra lateral fija a la
 * izquierda con navegación por rol; el contenido se renderiza a la derecha.
 */
export function WorkerWebShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  // Global: el layout padre no recibe ?sec= de las pantallas hijas con useLocalSearchParams.
  const params = useGlobalSearchParams<{ sec?: string }>();
  const { staffMember, loading } = useAuth();
  const { safeSignOut, signingOut } = useSafeSignOut();

  const rol = staffMember?.rol as WorkerRol | undefined;
  const { badges } = useWorkerNavBadges(rol, staffMember?.id ?? null, pathname);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={AcColors.accent} size="large" />
      </View>
    );
  }

  if (!staffMember) {
    return <View style={styles.bare}>{children}</View>;
  }

  const items = navForRole(staffMember.rol);

  const navPress = (item: WorkerNavItem) => {
    router.push(navItemHref(item) as Href);
  };

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Ionicons name="restaurant" size={20} color={AcColors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>A la Carta</Text>
            <Text style={styles.brandTag}>Consola de personal</Text>
          </View>
        </View>

        <View style={styles.nav}>
          {items.map((item) => {
            const active = isNavItemActive(item, pathname, params.sec, rol);
            const count = badgeCountForItem(item, badges);
            const isAlert = item.badgeAlert === true;
            return (
              <Pressable
                key={`${item.label}-${item.section ?? item.href}`}
                onPress={() => navPress(item)}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.navItem,
                  hovered && styles.navItemHover,
                  active && styles.navItemActive,
                ]}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={active ? AcColors.onAccent : AcColors.textMuted}
                />
                <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                {count > 0 ? (
                  <View style={[styles.badge, isAlert ? styles.badgeAlert : styles.badgeMuted]}>
                    <Text style={[styles.badgeText, isAlert ? styles.badgeTextAlert : styles.badgeTextMuted]}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.userBox}>
          <Pressable
            onPress={() => router.push('/perfil' as Href)}
            style={({ hovered }: { hovered?: boolean }) => [styles.userInfo, hovered && styles.userInfoHover]}>
            <Avatar uri={staffMember.foto_url} name={staffMember.nombre_visible} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {staffMember.nombre_visible}
              </Text>
              <Text style={styles.userRole}>{roleLabel(staffMember.rol)} · Mi perfil</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={safeSignOut}
            disabled={signingOut}
            hitSlop={8}
            style={({ hovered }: { hovered?: boolean }) => [
              styles.signOutBtn,
              hovered && styles.signOutBtnHover,
            ]}>
            <Ionicons name="log-out-outline" size={20} color={AcColors.danger} />
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: AcColors.background },
  bare: { flex: 1, backgroundColor: AcColors.background },
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: AcColors.background,
    minHeight: '100%',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: AcColors.surface,
    borderRightWidth: 1,
    borderRightColor: AcColors.border,
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6, marginBottom: 26 },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: AcColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 17, fontWeight: '800', color: AcColors.text, letterSpacing: 0.2 },
  brandTag: { fontSize: 11, color: AcColors.textMuted, marginTop: 1 },
  nav: { gap: 4, flex: 1 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  navItemHover: { backgroundColor: AcColors.surfaceElevated },
  navItemActive: { backgroundColor: AcColors.accent },
  navText: { flex: 1, fontSize: 14, fontWeight: '600', color: AcColors.textMuted },
  navTextActive: { color: AcColors.onAccent, fontWeight: '700' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAlert: { backgroundColor: AcColors.warning },
  badgeMuted: { backgroundColor: AcColors.surfaceElevated, borderWidth: 1, borderColor: AcColors.border },
  badgeText: { fontSize: 12, fontWeight: '800' },
  badgeTextAlert: { color: AcColors.background },
  badgeTextMuted: { color: AcColors.textMuted },
  userBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: AcColors.border,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 6,
    borderRadius: 11,
  },
  userInfoHover: { backgroundColor: AcColors.surfaceElevated },
  userName: { fontSize: 13, fontWeight: '700', color: AcColors.text },
  userRole: { fontSize: 11, color: AcColors.textMuted, marginTop: 1 },
  signOutBtn: { padding: 8, borderRadius: 9 },
  signOutBtnHover: { backgroundColor: AcColors.surfaceElevated },
  content: { flex: 1, minHeight: '100%' },
});
