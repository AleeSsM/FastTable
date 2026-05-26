import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/auth-context';
import { FtColors } from '@/constants/fasttable';
import { formatPriceFromCents } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type ServicioCerrado = {
  id: string;
  total_centavos: number;
  cerrado_en: string | null;
  nombre_invitado: string | null;
  mesas: { codigo: string } | { codigo: string }[] | null;
};

type LineaRecibo = {
  id: string;
  cantidad: number;
  items_menu: { nombre: string; precio_centavos: number } | { nombre: string; precio_centavos: number }[] | null;
};

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 }
    : { elevation: 3 };

function mesaCodigo(m: ServicioCerrado['mesas']): string {
  if (m == null) return '—';
  const z = Array.isArray(m) ? m[0] : m;
  return z?.codigo ?? '—';
}

function itemNombre(raw: LineaRecibo['items_menu']): string {
  if (raw == null) return '—';
  const z = Array.isArray(raw) ? raw[0] : raw;
  return z?.nombre ?? '—';
}

function itemPrecio(raw: LineaRecibo['items_menu']): number {
  if (raw == null) return 0;
  const z = Array.isArray(raw) ? raw[0] : raw;
  return z?.precio_centavos ?? 0;
}

export default function ServiciosCerradosScreen() {
  const { session, staffMember, loading: authLoading } = useAuth();
  const [lista, setLista] = useState<ServicioCerrado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaRecibo[]>([]);
  const [detalleBusy, setDetalleBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('servicios_mesa')
      .select('id, total_centavos, cerrado_en, nombre_invitado, mesas ( codigo )')
      .eq('estado', 'cerrado')
      .order('cerrado_en', { ascending: false })
      .limit(40);
    if (!error && data) setLista(data as ServicioCerrado[]);
    else setLista([]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  const abrirDetalle = async (id: string) => {
    setDetalleId(id);
    setDetalleBusy(true);
    setLineas([]);
    const { data } = await supabase
      .from('pedidos_cocina')
      .select('id, cantidad, items_menu ( nombre, precio_centavos )')
      .eq('id_servicio_mesa', id)
      .order('creado_en', { ascending: true });
    setLineas((data ?? []) as LineaRecibo[]);
    setDetalleBusy(false);
  };

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={FtColors.accent} />
      </View>
    );
  }

  if (!session || staffMember?.rol !== 'gerente') {
    return <Redirect href="/login" />;
  }

  const servicioSel = lista.find((s) => s.id === detalleId);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
            tintColor={FtColors.accent}
          />
        }>
        <Text style={styles.sub}>
          Recibos de servicios terminados: qué se pidió y el total cobrado al cerrar la mesa.
        </Text>
        {loading ? (
          <ActivityIndicator color={FtColors.accent} style={{ marginTop: 24 }} />
        ) : lista.length === 0 ? (
          <Text style={styles.empty}>Aún no hay servicios cerrados registrados.</Text>
        ) : (
          lista.map((s) => (
            <Pressable key={s.id} style={[styles.card, cardShadow]} onPress={() => void abrirDetalle(s.id)}>
              <View style={styles.cardTop}>
                <Text style={styles.mesa}>Mesa {mesaCodigo(s.mesas)}</Text>
                <Text style={styles.total}>{formatPriceFromCents(s.total_centavos)}</Text>
              </View>
              <Text style={styles.fecha}>
                {s.cerrado_en
                  ? new Date(s.cerrado_en).toLocaleString('es', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </Text>
              {s.nombre_invitado?.trim() ? (
                <Text style={styles.invitado}>{s.nombre_invitado.trim()}</Text>
              ) : null}
              <Text style={styles.ver}>Ver detalle →</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={detalleId != null} animationType="slide" onRequestClose={() => setDetalleId(null)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHead}>
            <Pressable onPress={() => setDetalleId(null)} hitSlop={12}>
              <Ionicons name="close" size={28} color={FtColors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>
              Recibo — Mesa {servicioSel ? mesaCodigo(servicioSel.mesas) : ''}
            </Text>
          </View>
          {detalleBusy ? (
            <ActivityIndicator color={FtColors.accent} style={{ marginTop: 24 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.modalScroll}>
              {lineas.map((ln) => {
                const pu = itemPrecio(ln.items_menu);
                const sub = ln.cantidad * pu;
                return (
                  <View key={ln.id} style={styles.linea}>
                    <Text style={styles.lineaNombre}>
                      {ln.cantidad}× {itemNombre(ln.items_menu)}
                    </Text>
                    <Text style={styles.lineaSub}>{formatPriceFromCents(sub)}</Text>
                  </View>
                );
              })}
              {servicioSel ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLbl}>Total del servicio</Text>
                  <Text style={styles.totalVal}>{formatPriceFromCents(servicioSel.total_centavos)}</Text>
                </View>
              ) : null}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FtColors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  sub: { fontSize: 14, color: FtColors.textMuted, marginBottom: 16, lineHeight: 20 },
  empty: { fontSize: 15, color: FtColors.textMuted, fontStyle: 'italic', marginTop: 12 },
  card: { backgroundColor: FtColors.surface, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mesa: { fontSize: 17, fontWeight: '700', color: FtColors.text },
  total: { fontSize: 17, fontWeight: '800', color: FtColors.accent },
  fecha: { fontSize: 13, color: FtColors.textMuted, marginTop: 6 },
  invitado: { fontSize: 13, color: FtColors.text, marginTop: 4 },
  ver: { fontSize: 13, color: FtColors.accent, marginTop: 8, fontWeight: '600' },
  modalSafe: { flex: 1, backgroundColor: FtColors.background },
  modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: FtColors.text, flex: 1 },
  modalScroll: { padding: 16, paddingBottom: 32 },
  linea: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  lineaNombre: { flex: 1, fontSize: 15, color: FtColors.text },
  lineaSub: { fontSize: 15, fontWeight: '600', color: FtColors.accent },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: FtColors.border,
  },
  totalLbl: { fontSize: 16, fontWeight: '700', color: FtColors.text },
  totalVal: { fontSize: 20, fontWeight: '800', color: FtColors.accent },
});
