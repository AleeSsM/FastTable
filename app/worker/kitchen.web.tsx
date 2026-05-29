import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { StatCard, WebCard, WebCardHead, WebHeader, WebRow, WebScroll, webStyles } from '@/components/web/ui';
import { FtColors } from '@/constants/fasttable';
import { useAuth } from '@/contexts/auth-context';
import { REALTIME_KITCHEN, useSupabaseRealtimeRefresh } from '@/hooks/use-supabase-realtime-refresh';
import { mapCocinaRpcError } from '@/lib/cocina-errors';
import { supabase } from '@/lib/supabase';
import { parseNavSection, type CocinaSection } from '@/lib/worker-nav';

const COCINA_TITLE: Record<CocinaSection, string> = {
  resumen: 'Vista general de pedidos pendientes y estado de la carta.',
  pedidos: 'Pedidos entrantes en tiempo real. Marca cada platillo como listo al terminarlo.',
  disponibilidad: 'Activa o desactiva platos para el comensal en tiempo real.',
};

type PedidoRow = {
  id: string;
  cantidad: number;
  nota_cliente: string | null;
  creado_en: string;
  mesas: { codigo: string } | { codigo: string }[] | null;
  items_menu: { nombre: string } | { nombre: string }[] | null;
};
type ItemDisp = {
  id: string;
  nombre: string;
  disponible: boolean;
  categorias_menu: { nombre: string } | { nombre: string }[] | null;
};

function catNombre(c: ItemDisp['categorias_menu']): string | null {
  if (c == null) return null;
  const z = Array.isArray(c) ? c[0] : c;
  return z?.nombre ?? null;
}
function mesaCodigo(m: PedidoRow['mesas']): string {
  if (m == null) return '—';
  const z = Array.isArray(m) ? m[0] : m;
  return z?.codigo ?? '—';
}
function itemNombre(i: PedidoRow['items_menu']): string {
  if (i == null) return '—';
  const z = Array.isArray(i) ? i[0] : i;
  return z?.nombre ?? '—';
}

export default function KitchenWebScreen() {
  const params = useLocalSearchParams<{ sec?: string }>();
  const { session, staffMember, loading: authLoading } = useAuth();
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [items, setItems] = useState<ItemDisp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');

  const load = useCallback(async () => {
    const [pRes, iRes] = await Promise.all([
      supabase
        .from('pedidos_cocina')
        .select('id, cantidad, nota_cliente, creado_en, mesas ( codigo ), items_menu ( nombre )')
        .eq('estado', 'pendiente')
        .order('creado_en', { ascending: true }),
      supabase
        .from('items_menu')
        .select('id, nombre, disponible, categorias_menu ( nombre )')
        .order('nombre'),
    ]);
    setPedidos((pRes.data as PedidoRow[]) ?? []);
    setItems((iRes.data as ItemDisp[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!session || !staffMember) return;
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

  useSupabaseRealtimeRefresh(
    REALTIME_KITCHEN,
    load,
    !!session && !!staffMember && (staffMember.rol === 'cocina' || staffMember.rol === 'gerente'),
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const c = catNombre(it.categorias_menu);
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [items]);

  const filteredPedidos = useMemo(() => {
    if (categoryFilter === 'todas') return pedidos;
    const allowed = new Set(
      items.filter((it) => catNombre(it.categorias_menu) === categoryFilter).map((it) => it.nombre),
    );
    return pedidos.filter((p) => allowed.has(itemNombre(p.items_menu)));
  }, [pedidos, items, categoryFilter]);

  const onListo = async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase.rpc('marcar_pedido_listo_cocina', { p_id_pedido: id });
      if (!error) await load();
    } finally {
      setBusyId(null);
    }
  };

  const onToggleDisponible = async (item: ItemDisp, value: boolean) => {
    setToggleBusy(item.id);
    try {
      const { error } = await supabase.rpc('cocina_set_item_disponible', {
        p_id_item: item.id,
        p_disponible: value,
      });
      if (!error) {
        setItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, disponible: value } : r)));
      } else {
        console.warn('Carta:', mapCocinaRpcError(error.message));
      }
    } finally {
      setToggleBusy(null);
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
  if (staffMember.rol !== 'cocina' && staffMember.rol !== 'gerente') return <Redirect href="/worker" />;

  const isCocinaRol = staffMember.rol === 'cocina';
  const sec = isCocinaRol
    ? (parseNavSection('cocina', params.sec, '/worker/kitchen') as CocinaSection)
    : 'pedidos';

  const statsRow = (
    <WebRow>
      <StatCard icon="flame-outline" tone={FtColors.warning} value={pedidos.length} label="Pedidos pendientes" />
      <StatCard
        icon="close-circle-outline"
        tone={FtColors.danger}
        value={items.filter((it) => !it.disponible).length}
        label="Platos no disponibles"
      />
      <StatCard icon="restaurant-outline" tone={FtColors.success} value={items.length} label="Platos en la carta" />
    </WebRow>
  );

  const pedidosPanel = (
    <>
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, categoryFilter === 'todas' && styles.filterChipOn]}
          onPress={() => setCategoryFilter('todas')}>
          <Text style={[styles.filterChipText, categoryFilter === 'todas' && styles.filterChipTextOn]}>Todas</Text>
        </Pressable>
        {categories.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.filterChip, categoryFilter === cat && styles.filterChipOn]}
            onPress={() => setCategoryFilter(cat)}>
            <Text style={[styles.filterChipText, categoryFilter === cat && styles.filterChipTextOn]}>{cat}</Text>
          </Pressable>
        ))}
      </View>
      {loading && !refreshing ? (
        <ActivityIndicator color={FtColors.accent} style={{ marginVertical: 24 }} />
      ) : filteredPedidos.length === 0 ? (
        <WebCard>
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-done-circle-outline" size={42} color={FtColors.success} />
            <Text style={styles.emptyTitle}>Todo al día</Text>
            <Text style={styles.emptyText}>No hay pedidos pendientes por preparar.</Text>
          </View>
        </WebCard>
      ) : (
        <View style={styles.board}>
          {filteredPedidos.map((p) => {
            const ageMs = Date.now() - new Date(p.creado_en).getTime();
            const slaStyle =
              ageMs > 20 * 60 * 1000 ? styles.slaLate : ageMs > 10 * 60 * 1000 ? styles.slaWarn : styles.slaOk;
            return (
              <View key={p.id} style={styles.ticket}>
                <View style={styles.ticketTop}>
                  <Text style={styles.ticketMesa}>Mesa {mesaCodigo(p.mesas)}</Text>
                  <Text style={styles.ticketTime}>
                    {new Date(p.creado_en).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.ticketPlato}>
                  {p.cantidad}× {itemNombre(p.items_menu)}
                </Text>
                <View style={styles.slaRow}>
                  <View style={[styles.slaDot, slaStyle]} />
                  <Text style={styles.slaText}>En cola {Math.max(1, Math.floor(ageMs / 60000))} min</Text>
                </View>
                {p.nota_cliente ? (
                  <View style={styles.notaBox}>
                    <Text style={styles.notaLabel}>Nota</Text>
                    <Text style={styles.notaText}>{p.nota_cliente}</Text>
                  </View>
                ) : (
                  <Text style={styles.sinNota}>Sin notas</Text>
                )}
                <Pressable
                  style={[styles.btnListo, busyId === p.id && styles.btnDisabled]}
                  onPress={() => onListo(p.id)}
                  disabled={busyId === p.id}>
                  {busyId === p.id ? (
                    <ActivityIndicator color={FtColors.onAccent} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color={FtColors.onAccent} />
                      <Text style={styles.btnListoText}>Listo</Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </>
  );

  const disponibilidadPanel = (
    <WebCard>
      <WebCardHead icon="options-outline" title="Disponibilidad de la carta" />
      <Text style={styles.panelHint}>Activa o desactiva platos para el comensal en tiempo real.</Text>
      <View style={styles.dispList}>
        {items.map((it) => (
          <View key={it.id} style={styles.dispRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.dispName} numberOfLines={1}>
                {it.nombre}
              </Text>
              {catNombre(it.categorias_menu) ? (
                <Text style={styles.dispCat}>{catNombre(it.categorias_menu)}</Text>
              ) : null}
            </View>
            <Switch
              value={it.disponible}
              onValueChange={(v) => onToggleDisponible(it, v)}
              disabled={toggleBusy === it.id}
              trackColor={{ false: FtColors.border, true: 'rgba(125,206,160,0.5)' }}
              thumbColor={it.disponible ? FtColors.success : FtColors.textMuted}
            />
          </View>
        ))}
      </View>
    </WebCard>
  );

  return (
    <WebScroll
      maxWidth={1480}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FtColors.accent} />
      }>
      <WebHeader
        eyebrow="Cocina"
        title={isCocinaRol ? 'Tablero de preparación' : 'Cocina · vista gerencia'}
        subtitle={isCocinaRol ? COCINA_TITLE[sec] : 'Pedidos entrantes en tiempo real.'}
      />

      {isCocinaRol && sec === 'resumen' ? (
        <>
          {statsRow}
          <View style={{ height: 18 }} />
          {pedidos.length > 0 ? (
            <>
              <Text style={styles.panelHint}>Últimos pedidos en cola (ve a Pedidos para el tablero completo).</Text>
              <View style={styles.board}>
                {filteredPedidos.slice(0, 6).map((p) => (
                  <View key={p.id} style={styles.ticket}>
                    <Text style={styles.ticketMesa}>Mesa {mesaCodigo(p.mesas)}</Text>
                    <Text style={styles.ticketPlato}>
                      {p.cantidad}× {itemNombre(p.items_menu)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <WebCard>
              <View style={styles.emptyBox}>
                <Ionicons name="checkmark-done-circle-outline" size={42} color={FtColors.success} />
                <Text style={styles.emptyTitle}>Todo al día</Text>
              </View>
            </WebCard>
          )}
        </>
      ) : isCocinaRol && sec === 'disponibilidad' ? (
        disponibilidadPanel
      ) : isCocinaRol ? (
        pedidosPanel
      ) : (
        <>
          {statsRow}
          <View style={{ height: 18 }} />
          <WebRow>
            <View style={[webStyles.col, { flex: 3, minWidth: 460 }]}>{pedidosPanel}</View>
            <View style={[webStyles.col, { flex: 1, minWidth: 300 }]}>{disponibilidadPanel}</View>
          </WebRow>
        </>
      )}

      <View style={{ height: 24 }} />
    </WebScroll>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: FtColors.background },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FtColors.border,
    backgroundColor: FtColors.surface,
  },
  filterChipOn: { borderColor: FtColors.accent, backgroundColor: FtColors.surfaceElevated },
  filterChipText: { fontSize: 13, color: FtColors.textMuted, fontWeight: '600' },
  filterChipTextOn: { color: FtColors.accent, fontWeight: '700' },
  board: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  ticket: {
    flexGrow: 1,
    flexBasis: 240,
    minWidth: 220,
    maxWidth: 320,
    padding: 16,
    borderRadius: 16,
    backgroundColor: FtColors.surfaceElevated,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
  },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketMesa: {
    fontSize: 12,
    fontWeight: '800',
    color: FtColors.accentMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ticketTime: { fontSize: 12, color: FtColors.textMuted },
  ticketPlato: { fontSize: 19, fontWeight: '800', color: FtColors.text, marginTop: 8 },
  slaRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  slaDot: { width: 9, height: 9, borderRadius: 999 },
  slaOk: { backgroundColor: FtColors.success },
  slaWarn: { backgroundColor: FtColors.warning },
  slaLate: { backgroundColor: FtColors.danger },
  slaText: { fontSize: 12, color: FtColors.textMuted },
  notaBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
  },
  notaLabel: { fontSize: 10, fontWeight: '700', color: FtColors.textFaint, marginBottom: 3, textTransform: 'uppercase' },
  notaText: { fontSize: 13, color: FtColors.text, lineHeight: 19 },
  sinNota: { fontSize: 12, color: FtColors.textFaint, marginTop: 10, fontStyle: 'italic' },
  btnListo: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: FtColors.accent,
  },
  btnListoText: { color: FtColors.onAccent, fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  emptyBox: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: FtColors.text },
  emptyText: { fontSize: 14, color: FtColors.textMuted },
  panelHint: { fontSize: 12, color: FtColors.textMuted, marginTop: -8, marginBottom: 12, lineHeight: 18 },
  dispList: { gap: 0 },
  dispRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FtColors.border,
  },
  dispName: { fontSize: 14, fontWeight: '600', color: FtColors.text },
  dispCat: { fontSize: 12, color: FtColors.textMuted, marginTop: 2 },
});
