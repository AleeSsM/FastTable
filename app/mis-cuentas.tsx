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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { AuthBoot } from '@/components/auth-boot';
import { Avatar } from '@/components/avatar';
import { Comensal } from '@/constants/theme-comensal';
import { useAuth } from '@/contexts/auth-context';
import { formatPriceFromCents } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useNavigateToWelcomeOnceWhen } from '@/hooks/use-auth-navigation';

type CuentaCerrada = {
  id: string;
  total_centavos: number;
  cerrado_en: string | null;
  mesa_codigo: string | null;
  mesero_nombre: string | null;
  mesero_foto: string | null;
};

type LineaRecibo = {
  id: string;
  cantidad: number;
  items_menu: { nombre: string; precio_centavos: number } | { nombre: string; precio_centavos: number }[] | null;
};

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 8 }
    : { elevation: 3 };

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

function fechaLarga(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MisCuentasScreen() {
  const insets = useSafeAreaInsets();
  const { session, user, loading: authLoading, signingOut } = useAuth();
  const needsHome = !authLoading && !signingOut && !session;
  useNavigateToWelcomeOnceWhen(needsHome);
  const [lista, setLista] = useState<CuentaCerrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaRecibo[]>([]);
  const [detalleBusy, setDetalleBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLista([]);
      return;
    }
    const { data, error } = await supabase.rpc('comensal_mis_recibos');
    if (!error && data) setLista(data as CuentaCerrada[]);
    else setLista([]);
  }, [user?.id]);

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

  if (authLoading || signingOut || needsHome) {
    return <AuthBoot />;
  }

  const cuentaSel = lista.find((s) => s.id === detalleId);
  const totalHistorico = lista.reduce((acc, s) => acc + (s.total_centavos ?? 0), 0);

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
            tintColor={Comensal.accent}
            colors={[Comensal.accent]}
          />
        }>
        <Text style={styles.eyebrow}>Historial</Text>
        <Text style={styles.title}>Mis cuentas</Text>
        <Text style={styles.sub}>
          Cada visita se guarda aquí al terminar el servicio: lo que pediste y el total.
        </Text>

        {loading ? (
          <ActivityIndicator color={Comensal.accent} style={{ marginTop: 28 }} />
        ) : lista.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={34} color={Comensal.textFaint} />
            <Text style={styles.empty}>Todavía no tienes cuentas.</Text>
            <Text style={styles.emptyHint}>
              Cuando termines un servicio en una mesa, tu recibo aparecerá aquí.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.resumen}>
              <Text style={styles.resumenLbl}>Visitas registradas</Text>
              <Text style={styles.resumenVal}>{lista.length}</Text>
              <View style={styles.resumenDivider} />
              <Text style={styles.resumenLbl}>Total acumulado</Text>
              <Text style={styles.resumenTotal}>{formatPriceFromCents(totalHistorico)}</Text>
            </View>

            {lista.map((s) => (
              <Pressable key={s.id} style={[styles.card, cardShadow]} onPress={() => void abrirDetalle(s.id)}>
                <View style={styles.cardTop}>
                  <Text style={styles.mesa}>Mesa {s.mesa_codigo ?? '—'}</Text>
                  <Text style={styles.total}>{formatPriceFromCents(s.total_centavos)}</Text>
                </View>
                <Text style={styles.fecha}>{fechaLarga(s.cerrado_en)}</Text>
                {s.mesero_nombre ? (
                  <View style={styles.meseroRow}>
                    <Avatar uri={s.mesero_foto} name={s.mesero_nombre} size={26} />
                    <Text style={styles.meseroText}>Te atendió {s.mesero_nombre}</Text>
                  </View>
                ) : null}
                <Text style={styles.ver}>Ver detalle →</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={detalleId != null} animationType="slide" onRequestClose={() => setDetalleId(null)}>
        <SafeAreaView style={styles.modalSafe} edges={['bottom']}>
          <View style={[styles.modalHead, { paddingTop: insets.top + 12 }]}>
            <Pressable onPress={() => setDetalleId(null)} hitSlop={12}>
              <Ionicons name="close" size={28} color={Comensal.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Recibo — Mesa {cuentaSel?.mesa_codigo ?? ''}</Text>
          </View>
          {cuentaSel ? <Text style={styles.modalFecha}>{fechaLarga(cuentaSel.cerrado_en)}</Text> : null}
          {cuentaSel?.mesero_nombre ? (
            <View style={styles.modalMeseroRow}>
              <Avatar uri={cuentaSel.mesero_foto} name={cuentaSel.mesero_nombre} size={32} />
              <Text style={styles.modalMeseroText}>Te atendió {cuentaSel.mesero_nombre}</Text>
            </View>
          ) : null}
          {detalleBusy ? (
            <ActivityIndicator color={Comensal.accent} style={{ marginTop: 24 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.modalScroll}>
              {lineas.length === 0 ? (
                <Text style={styles.empty}>No se registraron consumos en esta visita.</Text>
              ) : (
                lineas.map((ln) => {
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
                })
              )}
              {cuentaSel ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLbl}>Total</Text>
                  <Text style={styles.totalVal}>{formatPriceFromCents(cuentaSel.total_centavos)}</Text>
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
  safe: { flex: 1, backgroundColor: Comensal.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Comensal.background },
  scroll: { padding: 20, paddingBottom: 36 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: Comensal.accentMuted,
    marginBottom: 8,
  },
  title: { fontSize: 26, color: Comensal.text, fontWeight: '800', marginBottom: 8 },
  sub: { fontSize: 14, color: Comensal.textMuted, lineHeight: 21, marginBottom: 18 },
  resumen: {
    backgroundColor: Comensal.surfaceElevated,
    borderRadius: Comensal.radiusMd,
    borderWidth: 1,
    borderColor: Comensal.border,
    padding: 16,
    marginBottom: 16,
  },
  resumenLbl: { fontSize: 12, color: Comensal.textMuted, letterSpacing: 0.3 },
  resumenVal: { fontSize: 20, color: Comensal.text, fontWeight: '800', marginTop: 2 },
  resumenDivider: { height: 1, backgroundColor: Comensal.border, marginVertical: 12 },
  resumenTotal: { fontSize: 24, color: Comensal.accent, fontWeight: '800', marginTop: 2 },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: Comensal.surfaceElevated,
    borderRadius: Comensal.radiusMd,
    borderWidth: 1,
    borderColor: Comensal.border,
    padding: 28,
    marginTop: 8,
    gap: 8,
  },
  empty: { fontSize: 16, color: Comensal.text, fontWeight: '700', marginTop: 6 },
  emptyHint: { fontSize: 13, color: Comensal.textMuted, textAlign: 'center', lineHeight: 19 },
  card: {
    backgroundColor: Comensal.surfaceElevated,
    borderRadius: Comensal.radiusMd,
    borderWidth: 1,
    borderColor: Comensal.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mesa: { fontSize: 17, fontWeight: '800', color: Comensal.text },
  total: { fontSize: 18, fontWeight: '800', color: Comensal.accent },
  fecha: { fontSize: 13, color: Comensal.textMuted, marginTop: 6 },
  meseroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  meseroText: { fontSize: 13, color: Comensal.textMuted, fontWeight: '600' },
  ver: { fontSize: 13, color: Comensal.accent, marginTop: 10, fontWeight: '700' },
  modalSafe: { flex: 1, backgroundColor: Comensal.background },
  modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Comensal.text, flex: 1 },
  modalFecha: { fontSize: 13, color: Comensal.textMuted, paddingHorizontal: 16, marginTop: -4, marginBottom: 4 },
  modalMeseroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: 6, marginBottom: 4 },
  modalMeseroText: { fontSize: 14, color: Comensal.text, fontWeight: '600' },
  modalScroll: { padding: 16, paddingBottom: 32 },
  linea: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  lineaNombre: { flex: 1, fontSize: 15, color: Comensal.text, paddingRight: 12 },
  lineaSub: { fontSize: 15, fontWeight: '700', color: Comensal.accent },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Comensal.border,
  },
  totalLbl: { fontSize: 16, fontWeight: '700', color: Comensal.text },
  totalVal: { fontSize: 22, fontWeight: '800', color: Comensal.accent },
});
