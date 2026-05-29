import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FtColors } from '@/constants/fasttable';
import { useAuth } from '@/contexts/auth-context';
import { DEFAULT_MESERO_SECTION, navForRole, roleLabel } from '@/lib/worker-nav';

const SIDEBAR_WIDTH = 256;

function isActive(pathname: string, href: string): boolean {
  if (href === '/worker') return pathname === '/worker';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Marco de escritorio para el personal (solo web). Barra lateral fija a la
 * izquierda con navegación por rol; el contenido se renderiza a la derecha.
 * En móvil este componente no se usa (existe `_layout.tsx` con Stack).
 */
export function WorkerWebShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const params = useLocalSearchParams<{ sec?: string }>();
  const currentSec = typeof params.sec === 'string' ? params.sec : DEFAULT_MESERO_SECTION;
  const { staffMember, loading, signOut } = useAuth();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={FtColors.accent} size="large" />
      </View>
    );
  }

  // Sin ficha de personal (comensal o sesión cerrada): dejamos que la pantalla
  // hija haga su propio redirect, sin pintar el marco del personal.
  if (!staffMember) {
    return <View style={styles.bare}>{children}</View>;
  }

  const items = navForRole(staffMember.rol);

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Ionicons name="restaurant" size={20} color={FtColors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>FastTable</Text>
            <Text style={styles.brandTag}>Consola de personal</Text>
          </View>
        </View>

        <View style={styles.nav}>
          {items.map((item) => {
            const active = item.section
              ? isActive(pathname, item.href) && currentSec === item.section
              : isActive(pathname, item.href);
            const href = (item.section ? `${item.href}?sec=${item.section}` : item.href) as Href;
            return (
              <Pressable
                key={`${item.label}-${item.section ?? item.href}`}
                onPress={() => router.push(href)}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.navItem,
                  hovered && styles.navItemHover,
                  active && styles.navItemActive,
                ]}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={active ? FtColors.onAccent : FtColors.textMuted}
                />
                <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
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
            onPress={() => signOut()}
            hitSlop={8}
            style={({ hovered }: { hovered?: boolean }) => [
              styles.signOutBtn,
              hovered && styles.signOutBtnHover,
            ]}>
            <Ionicons name="log-out-outline" size={20} color={FtColors.danger} />
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: FtColors.background },
  bare: { flex: 1, backgroundColor: FtColors.background },
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: FtColors.background,
    minHeight: '100%',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: FtColors.surface,
    borderRightWidth: 1,
    borderRightColor: FtColors.border,
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6, marginBottom: 26 },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: FtColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 17, fontWeight: '800', color: FtColors.text, letterSpacing: 0.2 },
  brandTag: { fontSize: 11, color: FtColors.textMuted, marginTop: 1 },
  nav: { gap: 4, flex: 1 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  navItemHover: { backgroundColor: FtColors.surfaceElevated },
  navItemActive: { backgroundColor: FtColors.accent },
  navText: { fontSize: 14, fontWeight: '600', color: FtColors.textMuted },
  navTextActive: { color: FtColors.onAccent, fontWeight: '700' },
  userBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: FtColors.border,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 6,
    borderRadius: 11,
  },
  userInfoHover: { backgroundColor: FtColors.surfaceElevated },
  userName: { fontSize: 13, fontWeight: '700', color: FtColors.text },
  userRole: { fontSize: 11, color: FtColors.textMuted, marginTop: 1 },
  signOutBtn: { padding: 8, borderRadius: 9 },
  signOutBtnHover: { backgroundColor: FtColors.surfaceElevated },
  content: { flex: 1, minHeight: '100%' },
});
