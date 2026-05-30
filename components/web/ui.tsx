import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { AcColors } from '@/constants/alacarta';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Área desplazable centrada con ancho máximo, para pantallas de escritorio. */
export function WebScroll({
  children,
  maxWidth = 1280,
  refreshControl,
}: {
  children: ReactNode;
  maxWidth?: number;
  refreshControl?: ComponentProps<typeof ScrollView>['refreshControl'];
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.inner, { maxWidth }]}>{children}</View>
    </ScrollView>
  );
}

export function WebHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function WebCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function WebCardHead({
  icon,
  color,
  title,
  right,
}: {
  icon: IoniconName;
  color?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.cardHead}>
      <Ionicons name={icon} size={20} color={color ?? AcColors.accentText} />
      <Text style={styles.cardTitle}>{title}</Text>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

export function StatCard({
  value,
  label,
  icon,
  tone = AcColors.accent,
}: {
  value: ReactNode;
  label: string;
  icon?: IoniconName;
  tone?: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        {icon ? (
          <View style={[styles.statIcon, { backgroundColor: `${tone}22` }]}>
            <Ionicons name={icon} size={18} color={tone} />
          </View>
        ) : null}
        <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Fila que reparte hijos en columnas con wrap (cuadrícula simple). */
export function WebRow({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  return <View style={[styles.row, { gap }]}>{children}</View>;
}

export const webStyles = StyleSheet.create({
  col: { flex: 1, minWidth: 320 },
});

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: AcColors.background },
  scrollContent: { alignItems: 'center', paddingHorizontal: 36, paddingVertical: 32 },
  inner: { width: '100%' },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 24 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: AcColors.accentMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { fontSize: 30, fontWeight: '800', color: AcColors.text, marginTop: 6, letterSpacing: 0.2 },
  subtitle: { fontSize: 14, color: AcColors.textMuted, marginTop: 8, lineHeight: 21, maxWidth: 680 },
  card: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: AcColors.surfaceElevated,
    borderWidth: 1,
    borderColor: AcColors.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: AcColors.text, flex: 1 },
  statCard: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 160,
    padding: 18,
    borderRadius: 16,
    backgroundColor: AcColors.surfaceElevated,
    borderWidth: 1,
    borderColor: AcColors.border,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 28, fontWeight: '800', letterSpacing: 0.3 },
  statLabel: { fontSize: 13, color: AcColors.textMuted, marginTop: 10, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
