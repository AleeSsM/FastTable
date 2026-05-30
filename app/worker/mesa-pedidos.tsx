import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { FtColors } from '@/constants/fasttable';
import { REALTIME_WORKER_DASHBOARD, useSupabaseRealtimeRefresh } from '@/hooks/use-supabase-realtime-refresh';
import { fetchCuentaMesaServicio, mapMesaPedidoRpcError } from '@/lib/cuenta-mesa';
import { mapCocinaRpcError } from '@/lib/cocina-errors';
import { formatPriceFromCents } from '@/lib/format';
import { mesaEtiqueta } from '@/lib/mesa-label';
import {
  etiquetaDisponibilidadComensal,
  itemNoPedible,
  type ItemMenuComensal,
} from '@/lib/menu-comensal';
import { mapStaffRpcError } from '@/lib/worker-reservations-logic';
import { supabase } from '@/lib/supabase';

type Category = {
  id: string;
  nombre: string;
  orden: number;
  items_menu: ItemMenuComensal[] | null;
};

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 }
    : { elevation: 3 };

function placeholderImage(itemId: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(itemId)}-ft/600/400`;
}

export default function MesaPedidosScreen() {
  const router = useRouter();
  const { mesaId, codigo } = useLocalSearchParams<{ mesaId: string; codigo?: string }>();
  const { session, staffMember, loading: authLoading } = useAuth();
  const [sections, setSections] = useState<Category[]>([]);
  const [cuenta, setCuenta] = useState<Awaited<ReturnType<typeof fetchCuentaMesaServicio>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalItem, setModalItem] = useState<ItemMenuComensal | null>(null);
  const [qty, setQty] = useState(1);
  const [nota, setNota] = useState('');
  const [sending, setSending] = useState(false);

  const idMesa = typeof mesaId === 'string' ? mesaId : '';
  const mesaLabel = mesaEtiqueta(typeof codigo === 'string' ? codigo : null);

  const load = useCallback(async () => {
    if (!idMesa) return;
    const [menuRes, cuentaRes] = await Promise.all([
      supabase
        .from('categorias_menu')
        .select('id, nombre, orden, items_menu ( id, nombre, descripcion, precio_centavos, disponible, sin_stock, imagen_url )')
        .order('orden'),
      fetchCuentaMesaServicio(idMesa),
    ]);
    if (!menuRes.error && menuRes.data) {
      setSections(
        menuRes.data.map((c) => ({
          ...c,
          items_menu: [...(c.items_menu ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        })),
      );
    }
    setCuenta(cuentaRes);
  }, [idMesa]);

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

  useSupabaseRealtimeRefresh(
    REALTIME_WORKER_DASHBOARD,
    () => {
      void load();
    },
    !!idMesa,
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const enviarPedido = async () => {
    if (!modalItem || !idMesa) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc('personal_crear_pedido_mesa', {
        p_id_mesa: idMesa,
        p_id_item: modalItem.id,
        p_cantidad: qty,
        p_nota: nota.trim() || null,
      });
      if (error) {
        let msg = mapCocinaRpcError(error.message);
        const staff = mapStaffRpcError(msg);
        if (staff !== msg) msg = staff;
        else {
          const mesa = mapMesaPedidoRpcError(msg);
          if (mesa !== msg) msg = mesa;
        }
        Alert.alert('Pedido', msg);
        return;
      }
      setModalItem(null);
      setQty(1);
      setNota('');
      await load();
      Alert.alert('Listo', 'Pedido enviado a cocina.');
    } finally {
      setSending(false);
    }
  };

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={FtColors.accent} />
      </View>
    );
  }

  if (!session || !staffMember || staffMember.rol === 'cocina') {
    return <Redirect href="/login" />;
  }

  if (!idMesa) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.err}>Falta el identificador de la mesa.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={FtColors.accent} />}>
        <Text style={styles.title}>{mesaLabel}</Text>
        <Text style={styles.sub}>Agrega platos a la cuenta de este servicio. El comensal verá los mismos ítems.</Text>

        <View style={[styles.cuentaCard, cardShadow]}>
          <Text style={styles.cuentaTitle}>Cuenta del servicio</Text>
          {loading && !cuenta ? (
            <ActivityIndicator color={FtColors.accent} style={{ marginVertical: 12 }} />
          ) : cuenta && cuenta.lines.length > 0 ? (
            <>
              {cuenta.lines.map((ln) => (
                <View key={ln.id} style={styles.cuentaRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cuentaLine}>
                      {ln.cantidad}× {ln.nombre}
                    </Text>
                    {ln.registrado_por_mesero ? (
                      <Text style={styles.cuentaTag}>Registrado por mesero</Text>
                    ) : null}
                  </View>
                  <Text style={styles.cuentaSub}>{formatPriceFromCents(ln.subtotal_centavos)}</Text>
                </View>
              ))}
              <View style={styles.cuentaTotalRow}>
                <Text style={styles.cuentaTotalLabel}>Total</Text>
                <Text style={styles.cuentaTotal}>{formatPriceFromCents(cuenta.total_centavos)}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.cuentaEmpty}>Sin pedidos en este servicio.</Text>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={FtColors.accent} style={{ marginTop: 24 }} />
        ) : (
          sections.map((cat) => (
            <View key={cat.id} style={styles.section}>
              <Text style={styles.catName}>{cat.nombre}</Text>
              {(cat.items_menu ?? []).map((item) => {
                const noPedible = itemNoPedible(item);
                const etiqueta = etiquetaDisponibilidadComensal(item);
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.itemCard, cardShadow, noPedible && styles.itemDisabled]}
                    disabled={noPedible}
                    onPress={() => {
                      setModalItem(item);
                      setQty(1);
                      setNota('');
                    }}>
                    <Image
                      source={{ uri: item.imagen_url ?? placeholderImage(item.id) }}
                      style={styles.itemImg}
                      contentFit="cover"
                    />
                    <View style={styles.itemBody}>
                      <Text style={styles.itemName}>{item.nombre}</Text>
                      <Text style={styles.itemPrice}>{formatPriceFromCents(item.precio_centavos)}</Text>
                      {etiqueta ? <Text style={styles.itemBadge}>{etiqueta}</Text> : null}
                    </View>
                    {!noPedible ? (
                      <Ionicons name="add-circle" size={28} color={FtColors.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalItem != null} transparent animationType="slide" onRequestClose={() => setModalItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, cardShadow]}>
            <Text style={styles.modalTitle}>{modalItem?.nombre}</Text>
            <View style={styles.qtyRow}>
              <Pressable style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
                <Ionicons name="remove" size={22} color={FtColors.text} />
              </Pressable>
              <Text style={styles.qtyVal}>{qty}</Text>
              <Pressable style={styles.qtyBtn} onPress={() => setQty((q) => Math.min(99, q + 1))}>
                <Ionicons name="add" size={22} color={FtColors.text} />
              </Pressable>
            </View>
            <TextInput
              style={styles.notaInput}
              placeholder="Nota para cocina (opcional)"
              placeholderTextColor={FtColors.textMuted}
              value={nota}
              onChangeText={setNota}
              multiline
            />
            <Pressable
              style={[styles.btnSolid, sending && styles.btnDisabled]}
              disabled={sending}
              onPress={() => void enviarPedido()}>
              {sending ? (
                <ActivityIndicator color={FtColors.onAccent} />
              ) : (
                <Text style={styles.btnSolidText}>Enviar a cocina</Text>
              )}
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => setModalItem(null)}>
              <Text style={styles.btnGhostText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FtColors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: FtColors.background },
  scroll: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800', color: FtColors.text },
  sub: { fontSize: 14, color: FtColors.textMuted, marginTop: 6, marginBottom: 16, lineHeight: 20 },
  cuentaCard: { backgroundColor: FtColors.surface, borderRadius: 12, padding: 14, marginBottom: 20 },
  cuentaTitle: { fontSize: 16, fontWeight: '700', color: FtColors.text, marginBottom: 10 },
  cuentaRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  cuentaLine: { fontSize: 14, color: FtColors.text },
  cuentaTag: { fontSize: 11, color: FtColors.textMuted, marginTop: 2 },
  cuentaSub: { fontSize: 14, fontWeight: '600', color: FtColors.accent },
  cuentaTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: FtColors.border },
  cuentaTotalLabel: { fontSize: 15, fontWeight: '700', color: FtColors.text },
  cuentaTotal: { fontSize: 18, fontWeight: '800', color: FtColors.accent },
  cuentaEmpty: { fontSize: 14, color: FtColors.textMuted, fontStyle: 'italic' },
  section: { marginBottom: 20 },
  catName: { fontSize: 17, fontWeight: '700', color: FtColors.text, marginBottom: 10 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FtColors.surface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  itemDisabled: { opacity: 0.55 },
  itemImg: { width: 56, height: 56, borderRadius: 8 },
  itemBody: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: FtColors.text },
  itemPrice: { fontSize: 13, color: FtColors.accent, marginTop: 2 },
  itemBadge: { fontSize: 11, color: FtColors.textMuted, marginTop: 2 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: FtColors.surfaceElevated, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: FtColors.text, marginBottom: 16 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 16 },
  qtyBtn: { padding: 8 },
  qtyVal: { fontSize: 22, fontWeight: '700', color: FtColors.text, minWidth: 40, textAlign: 'center' },
  notaInput: {
    borderWidth: 1,
    borderColor: FtColors.border,
    borderRadius: 8,
    padding: 12,
    color: FtColors.text,
    minHeight: 72,
    marginBottom: 14,
    textAlignVertical: 'top',
  },
  btnSolid: {
    backgroundColor: FtColors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSolidText: { color: FtColors.onAccent, fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
  btnGhost: { marginTop: 10, alignItems: 'center', padding: 10 },
  btnGhostText: { color: FtColors.textMuted, fontSize: 15 },
  err: { color: FtColors.text, padding: 16 },
  link: { color: FtColors.accent, padding: 16, fontWeight: '600' },
});
