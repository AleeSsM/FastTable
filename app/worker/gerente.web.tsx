import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { StatCard, WebCard, WebCardHead, WebHeader, WebRow, WebScroll, webStyles } from '@/components/web/ui';
import { FtColors, FtSurfaces } from '@/constants/fasttable';
import { useAuth } from '@/contexts/auth-context';
import { REALTIME_GERENTE, useSupabaseRealtimeRefresh } from '@/hooks/use-supabase-realtime-refresh';
import { formatPriceFromCents } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { parseNavSection, roleLabel, type GerenteSection } from '@/lib/worker-nav';

const GERENTE_TITLE: Record<GerenteSection, string> = {
  resumen: 'Indicadores del restaurante. Se actualizan solos al registrar pedidos o cambiar la carta.',
  reportes: 'Problemas reportados por comensales: quién atendió y cómo contactarlos.',
};

type GerenteStats = {
  total_centavos: number;
  plato_top: { nombre: string; unidades: number } | null;
  equipo: { nombre: string; rol: string }[];
  no_disponibles: { nombre: string }[];
};
type DailyMetric = { label: string; value: number };
type LiveSnapshot = {
  mesasLibres: number;
  mesasOcupadas: number;
  mesasReservadas: number;
  solicitudesAbiertas: number;
  reservasActivas: number;
  pedidosPendientes: number;
};
type RangeOption = 7 | 30;
type TopDish = { name: string; units: number };
type EquipoMiembro = { nombre_visible: string; rol: string; foto_url: string | null };
type ReporteProblema = {
  id: string;
  nombre_usuario: string | null;
  titulo: string;
  descripcion: string;
  estado: 'abierto' | 'revisado' | 'cerrado';
  creado_en: string;
  mesero_nombre: string | null;
  correo_contacto: string | null;
  telefono_contacto: string | null;
};

function priceFromItem(raw: unknown): number {
  if (raw == null) return 0;
  const z = Array.isArray(raw) ? raw[0] : raw;
  return (z as { precio_centavos?: number })?.precio_centavos ?? 0;
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function GerenteWebScreen() {
  const params = useLocalSearchParams<{ sec?: string }>();
  const { session, staffMember, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<GerenteStats | null>(null);
  const [rangeDays, setRangeDays] = useState<RangeOption>(7);
  const [dailyRevenue, setDailyRevenue] = useState<DailyMetric[]>([]);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [topDishes, setTopDishes] = useState<TopDish[]>([]);
  const [equipo, setEquipo] = useState<EquipoMiembro[]>([]);
  const [reportes, setReportes] = useState<ReporteProblema[]>([]);
  const [reportBusyId, setReportBusyId] = useState<string | null>(null);
  const [previousPeriodTotal, setPreviousPeriodTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const rangeStart = new Date(todayStart);
    rangeStart.setDate(todayStart.getDate() - (rangeDays - 1));
    const previousStart = new Date(rangeStart);
    previousStart.setDate(rangeStart.getDate() - rangeDays);
    const previousEndExclusive = new Date(rangeStart);

    const [statsRes, pedidosRes, previousRes, mesasRes, solRes, reservasRes, cocinaPendRes, reportesRes, equipoRes] =
      await Promise.all([
        supabase.rpc('gerente_dashboard_stats'),
        supabase
          .from('pedidos_cocina')
          .select('creado_en, cantidad, items_menu ( nombre, precio_centavos )')
          .gte('creado_en', rangeStart.toISOString())
          .order('creado_en', { ascending: true }),
        supabase
          .from('pedidos_cocina')
          .select('creado_en, cantidad, items_menu ( precio_centavos )')
          .gte('creado_en', previousStart.toISOString())
          .lt('creado_en', previousEndExclusive.toISOString()),
        supabase.from('mesas').select('estado'),
        supabase.from('solicitudes_servicio').select('*', { count: 'exact', head: true }).eq('estado', 'abierta'),
        supabase.from('reservas_mesa').select('*', { count: 'exact', head: true }).eq('ciclo', 'activa'),
        supabase.from('pedidos_cocina').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabase
          .from('reportes_problema')
          .select(
            'id, nombre_usuario, titulo, descripcion, estado, creado_en, mesero_nombre, correo_contacto, telefono_contacto',
          )
          .order('creado_en', { ascending: false })
          .limit(40),
        supabase
          .from('personal')
          .select('nombre_visible, rol, foto_url')
          .eq('activo', true)
          .order('nombre_visible'),
      ]);

    const { data, error } = statsRes;
    if (error) {
      setStats(null);
      setDailyRevenue([]);
      setSnapshot(null);
      setTopDishes([]);
      setReportes([]);
      setEquipo([]);
      setPreviousPeriodTotal(null);
      return;
    }
    setEquipo((equipoRes.data as EquipoMiembro[] | null) ?? []);
    setStats(data as GerenteStats);

    const byDay = new Map<string, number>();
    for (let i = 0; i < rangeDays; i += 1) {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      byDay.set(localDayKey(d), 0);
    }
    const topMap = new Map<string, number>();
    for (const row of pedidosRes.data ?? []) {
      const key = localDayKey(new Date(row.creado_en));
      if (!byDay.has(key)) continue;
      const subtotal = row.cantidad * priceFromItem(row.items_menu);
      byDay.set(key, (byDay.get(key) ?? 0) + subtotal);
      const itemInfo = Array.isArray(row.items_menu) ? row.items_menu[0] : row.items_menu;
      const name = itemInfo?.nombre?.trim() || 'Sin nombre';
      topMap.set(name, (topMap.get(name) ?? 0) + row.cantidad);
    }
    setDailyRevenue(
      [...byDay.entries()].map(([isoDay, total]) => {
        const d = new Date(`${isoDay}T00:00:00`);
        return { label: d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' }), value: total };
      }),
    );
    setTopDishes(
      [...topMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, units]) => ({ name, units })),
    );

    let prevTotal = 0;
    for (const row of previousRes.data ?? []) prevTotal += row.cantidad * priceFromItem(row.items_menu);
    setPreviousPeriodTotal(prevTotal);

    const mesas = mesasRes.data ?? [];
    setSnapshot({
      mesasLibres: mesas.filter((m) => m.estado === 'libre').length,
      mesasOcupadas: mesas.filter((m) => m.estado === 'ocupada').length,
      mesasReservadas: mesas.filter((m) => m.estado === 'reservada').length,
      solicitudesAbiertas: solRes.count ?? 0,
      reservasActivas: reservasRes.count ?? 0,
      pedidosPendientes: cocinaPendRes.count ?? 0,
    });
    setReportes((reportesRes.data as ReporteProblema[] | null) ?? []);
  }, [rangeDays]);

  useFocusEffect(
    useCallback(() => {
      if (!session || !staffMember || staffMember.rol !== 'gerente') return;
      let a = true;
      setLoading(true);
      load().finally(() => {
        if (a) setLoading(false);
      });
      return () => {
        a = false;
      };
    }, [session, staffMember, load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const reloadRealtime = useCallback(() => load(), [load]);
  useSupabaseRealtimeRefresh(
    REALTIME_GERENTE,
    reloadRealtime,
    !!session && !!staffMember && staffMember.rol === 'gerente',
  );

  const onMarcarReporteRevisado = async (id: string) => {
    setReportBusyId(id);
    try {
      const { error } = await supabase
        .from('reportes_problema')
        .update({ estado: 'revisado', actualizado_en: new Date().toISOString() })
        .eq('id', id)
        .eq('estado', 'abierto');
      if (!error) await load();
    } finally {
      setReportBusyId(null);
    }
  };

  if (authLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={FtColors.accent} size="large" />
      </View>
    );
  }
  if (!session) return <Redirect href="/" />;
  if (!staffMember) return <Redirect href="/login" />;
  if (staffMember.rol !== 'gerente') return <Redirect href="/worker" />;

  const sec = parseNavSection('gerente', params.sec, '/worker/gerente') as GerenteSection;
  const reportesAbiertos = reportes.filter((r) => r.estado === 'abierto').length;

  const maxRevenue = Math.max(1, ...dailyRevenue.map((d) => d.value));
  const rangeTotal = dailyRevenue.reduce((acc, d) => acc + d.value, 0);
  const variation =
    previousPeriodTotal == null || previousPeriodTotal === 0
      ? null
      : ((rangeTotal - previousPeriodTotal) / previousPeriodTotal) * 100;

  return (
    <WebScroll
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FtColors.accent} />
      }>
      <WebHeader
        eyebrow="Gerencia"
        title={`Hola, ${staffMember.nombre_visible}`}
        subtitle={GERENTE_TITLE[sec]}
        right={
          sec === 'resumen' ? (
          <View style={styles.segment}>
            {[7, 30].map((n) => (
              <Pressable
                key={n}
                onPress={() => setRangeDays(n as RangeOption)}
                style={[styles.segItem, rangeDays === n && styles.segItemOn]}>
                <Text style={[styles.segText, rangeDays === n && styles.segTextOn]}>{n} días</Text>
              </Pressable>
            ))}
          </View>
          ) : null
        }
      />

      {loading && !refreshing ? <ActivityIndicator color={FtColors.accent} style={{ marginVertical: 12 }} /> : null}

      {sec === 'reportes' ? (
        <WebCard>
          <WebCardHead
            icon="mail-unread-outline"
            color={FtColors.warning}
            title={`Problemas reportados${reportesAbiertos > 0 ? ` · ${reportesAbiertos} abiertos` : ''}`}
          />
          {reportes.length === 0 ? (
            <Text style={styles.muted}>No hay reportes por revisar.</Text>
          ) : (
            <View style={styles.repGrid}>
              {reportes.map((r) => (
                <View key={r.id} style={styles.repCard}>
                  <View style={styles.repTop}>
                    <Text style={styles.repName} numberOfLines={1}>
                      {r.nombre_usuario?.trim() || 'Comensal'}
                    </Text>
                    <Text style={[styles.repState, r.estado !== 'abierto' && styles.repStateDone]}>{r.estado}</Text>
                  </View>
                  <Text style={styles.repTitle} numberOfLines={2}>
                    {r.titulo}
                  </Text>
                  <Text style={styles.repDesc} numberOfLines={4}>
                    {r.descripcion}
                  </Text>
                  {r.mesero_nombre ? (
                    <View style={styles.repInfoRow}>
                      <Ionicons name="restaurant-outline" size={14} color={FtColors.textMuted} />
                      <Text style={styles.repInfoText}>Atendió: {r.mesero_nombre}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.repMeta}>
                    {new Date(r.creado_en).toLocaleString('es', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  {r.telefono_contacto || r.correo_contacto ? (
                    <View style={styles.repContactRow}>
                      {r.telefono_contacto ? (
                        <Pressable
                          style={styles.repContactBtn}
                          onPress={() => Linking.openURL(`tel:${r.telefono_contacto}`)}>
                          <Ionicons name="call-outline" size={14} color={FtColors.accent} />
                          <Text style={styles.repContactText} numberOfLines={1}>
                            {r.telefono_contacto}
                          </Text>
                        </Pressable>
                      ) : null}
                      {r.correo_contacto ? (
                        <Pressable
                          style={styles.repContactBtn}
                          onPress={() =>
                            Linking.openURL(
                              `mailto:${r.correo_contacto}?subject=${encodeURIComponent('Sobre tu reporte en FastTable')}`,
                            )
                          }>
                          <Ionicons name="mail-outline" size={14} color={FtColors.accent} />
                          <Text style={styles.repContactText} numberOfLines={1}>
                            {r.correo_contacto}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  {r.estado === 'abierto' ? (
                    <Pressable
                      style={[styles.repBtn, reportBusyId === r.id && styles.btnDisabled]}
                      onPress={() => onMarcarReporteRevisado(r.id)}
                      disabled={reportBusyId === r.id}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={FtColors.onAccent} />
                      <Text style={styles.repBtnText}>{reportBusyId === r.id ? 'Guardando…' : 'Marcar revisado'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </WebCard>
      ) : (
        <>
      <WebRow>
        <StatCard
          icon="cash-outline"
          tone={FtColors.accent}
          value={stats != null ? formatPriceFromCents(stats.total_centavos) : '—'}
          label="Ingresos (histórico)"
        />
        <StatCard
          icon="trending-up-outline"
          tone={variation == null ? FtColors.textMuted : variation >= 0 ? FtColors.success : FtColors.danger}
          value={variation == null ? '—' : `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`}
          label={`Variación vs ${rangeDays} días previos`}
        />
        <StatCard
          icon="trophy-outline"
          tone={FtColors.warning}
          value={stats?.plato_top?.nombre ?? '—'}
          label={stats?.plato_top ? `${stats.plato_top.unidades} uds. vendidas` : 'Sin datos aún'}
        />
        <StatCard
          icon="cash-outline"
          tone={FtColors.text}
          value={formatPriceFromCents(rangeTotal)}
          label={`Ingresos últimos ${rangeDays} días`}
        />
      </WebRow>

      <View style={{ height: 16 }} />

      <WebRow>
        <View style={[webStyles.col, { flex: 2, minWidth: 420 }]}>
          <WebCard>
            <WebCardHead icon="bar-chart-outline" title={`Ingresos por día · últimos ${rangeDays} días`} />
            <View style={styles.chartRow}>
              {dailyRevenue.map((d, idx) => (
                <View key={`${d.label}-${idx}`} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: `${Math.max(4, (d.value / maxRevenue) * 100)}%` }]} />
                  </View>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {d.label}
                  </Text>
                </View>
              ))}
            </View>
          </WebCard>

          <View style={{ height: 16 }} />

          <WebCard>
            <WebCardHead icon="analytics-outline" color={FtColors.warning} title="Top platos del periodo" />
            {topDishes.length === 0 ? (
              <Text style={styles.muted}>Sin pedidos en este rango.</Text>
            ) : (
              topDishes.map((dish, idx) => (
                <View key={`${dish.name}-${idx}`} style={styles.topRow}>
                  <Text style={styles.topRank}>{idx + 1}</Text>
                  <Text style={styles.topName} numberOfLines={1}>
                    {dish.name}
                  </Text>
                  <Text style={styles.topUnits}>{dish.units} uds.</Text>
                </View>
              ))
            )}
          </WebCard>
        </View>

        <View style={[webStyles.col, { flex: 1, minWidth: 300 }]}>
          <WebCard>
            <WebCardHead icon="pulse-outline" color={FtColors.success} title="Operación en vivo" />
            <View style={styles.liveGrid}>
              {[
                { v: snapshot?.mesasLibres, l: 'Mesas libres', c: FtColors.success },
                { v: snapshot?.mesasOcupadas, l: 'Mesas ocupadas', c: FtColors.warning },
                { v: snapshot?.mesasReservadas, l: 'Mesas reservadas', c: FtColors.accent },
                { v: snapshot?.solicitudesAbiertas, l: 'Solicitudes', c: FtColors.danger },
                { v: snapshot?.reservasActivas, l: 'Reservas activas', c: FtColors.accent },
                { v: snapshot?.pedidosPendientes, l: 'Pedidos en cocina', c: FtColors.warning },
              ].map((m) => (
                <View key={m.l} style={styles.livePill}>
                  <Text style={[styles.liveValue, { color: m.c }]}>{m.v ?? '—'}</Text>
                  <Text style={styles.liveLabel}>{m.l}</Text>
                </View>
              ))}
            </View>
          </WebCard>

          <View style={{ height: 16 }} />

          <WebCard>
            <WebCardHead icon="people-outline" color={FtColors.success} title="Equipo activo" />
            {equipo.length === 0 ? (
              <Text style={styles.muted}>Sin registros.</Text>
            ) : (
              equipo.map((p, i) => (
                <View key={`${p.nombre_visible}-${i}`} style={styles.equipoRow}>
                  <Avatar uri={p.foto_url} name={p.nombre_visible} size={36} />
                  <Text style={styles.equipoName} numberOfLines={1}>
                    {p.nombre_visible}
                  </Text>
                  <Text style={styles.equipoRol}>{roleLabel(p.rol)}</Text>
                </View>
              ))
            )}
          </WebCard>

          <View style={{ height: 16 }} />

          <WebCard>
            <WebCardHead icon="close-circle-outline" color={FtColors.danger} title="Platos no disponibles" />
            {(stats?.no_disponibles ?? []).length === 0 ? (
              <Text style={styles.muted}>Todo el menú está disponible.</Text>
            ) : (
              stats!.no_disponibles.map((it, i) => (
                <Text key={`${it.nombre}-${i}`} style={styles.listItem}>
                  · {it.nombre}
                </Text>
              ))
            )}
          </WebCard>
        </View>
      </WebRow>

      <View style={{ height: 24 }} />
        </>
      )}
    </WebScroll>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: FtColors.background },
  segment: {
    flexDirection: 'row',
    backgroundColor: FtColors.surface,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: FtColors.border,
    padding: 3,
  },
  segItem: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8 },
  segItemOn: { backgroundColor: FtColors.accent },
  segText: { fontSize: 13, fontWeight: '700', color: FtColors.textMuted },
  segTextOn: { color: FtColors.onAccent },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 190 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  barTrack: {
    width: '100%',
    flex: 1,
    borderRadius: 10,
    backgroundColor: FtColors.surface,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
  },
  barFill: { width: '100%', backgroundColor: FtColors.accent, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  barLabel: { marginTop: 8, fontSize: 11, color: FtColors.textMuted, textTransform: 'capitalize' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FtColors.borderSubtle,
  },
  topRank: {
    width: 24,
    height: 24,
    borderRadius: 8,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '800',
    color: FtColors.accentText,
    backgroundColor: FtColors.surface,
  },
  topName: { flex: 1, fontSize: 14, color: FtColors.text },
  topUnits: { fontSize: 13, color: FtColors.accentText, fontWeight: '700' },
  muted: { fontSize: 14, color: FtColors.textFaint },
  liveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  livePill: {
    flexGrow: 1,
    flexBasis: 90,
    minWidth: 84,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
  },
  liveValue: { fontSize: 22, fontWeight: '800' },
  liveLabel: { fontSize: 11, color: FtColors.textMuted, marginTop: 4, lineHeight: 14 },
  equipoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FtColors.border,
  },
  equipoName: { fontSize: 14, fontWeight: '600', color: FtColors.text, flex: 1, marginRight: 8 },
  equipoRol: { fontSize: 12, color: FtColors.textMuted },
  listItem: { fontSize: 14, color: FtColors.text, marginTop: 6, lineHeight: 22 },
  repGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  repCard: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 260,
    maxWidth: 360,
    padding: 14,
    borderRadius: 14,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
  },
  repTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  repName: { fontSize: 13, fontWeight: '700', color: FtColors.textMuted, flex: 1 },
  repState: {
    fontSize: 11,
    fontWeight: '800',
    color: FtColors.warning,
    textTransform: 'uppercase',
    backgroundColor: FtSurfaces.warningBanner,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  repStateDone: { color: FtColors.success, backgroundColor: FtSurfaces.successBanner },
  repTitle: { fontSize: 15, fontWeight: '800', color: FtColors.text, marginTop: 8 },
  repDesc: { fontSize: 13, color: FtColors.textMuted, lineHeight: 19, marginTop: 5 },
  repInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  repInfoText: { fontSize: 12.5, color: FtColors.text, fontWeight: '600' },
  repContactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  repContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FtColors.border,
    backgroundColor: FtColors.surface,
    maxWidth: '100%',
  },
  repContactText: { fontSize: 12.5, color: FtColors.accentText, fontWeight: '600', flexShrink: 1 },
  repMeta: { fontSize: 11, color: FtColors.textFaint, marginTop: 8 },
  repBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: FtColors.accent,
  },
  repBtnText: { fontSize: 13, fontWeight: '800', color: FtColors.onAccent },
  btnDisabled: { opacity: 0.6 },
});
