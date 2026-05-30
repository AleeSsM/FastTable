import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';

import { useAuth } from '@/contexts/auth-context';
import { FtColors } from '@/constants/fasttable';
import { REALTIME_INVENTARIO, useSupabaseRealtimeRefresh } from '@/hooks/use-supabase-realtime-refresh';
import {
  cantidadParaEdicion,
  etiquetaCampoCantidad,
  formatCantidadInventario,
  normalizeUnidadMedida,
  parseCantidadInventario,
  placeholderCantidadInventario,
  tecladoCantidadInventario,
} from '@/lib/format';
import { supabase } from '@/lib/supabase';

type CategoriaInventario = 'Bebidas' | 'Alimentos' | 'Ingredientes' | 'Otros';

type Ingrediente = {
  id: string;
  nombre: string;
  cantidad_disponible: number;
  unidad_medida: string;
  stock_minimo: number | null;
  categoria: CategoriaInventario | null;
};

type MovRow = {
  id: string;
  tipo: string;
  delta_cantidad: number;
  nota: string | null;
  creado_en: string;
  ingredientes: { nombre: string; unidad_medida: string } | { nombre: string; unidad_medida: string }[] | null;
};

const CATEGORIAS: readonly CategoriaInventario[] = ['Bebidas', 'Alimentos', 'Ingredientes', 'Otros'] as const;

const CATEGORIA_ICONS: Record<CategoriaInventario, ComponentProps<typeof Ionicons>['name']> = {
  Bebidas: 'wine-outline',
  Alimentos: 'restaurant-outline',
  Ingredientes: 'leaf-outline',
  Otros: 'cube-outline',
};

function ingNombre(m: MovRow['ingredientes']): string {
  if (m == null) return '—';
  const z = Array.isArray(m) ? m[0] : m;
  return z?.nombre ?? '—';
}

function ingUnidad(m: MovRow['ingredientes']): string {
  if (m == null) return 'g';
  const z = Array.isArray(m) ? m[0] : m;
  return z?.unidad_medida ?? 'g';
}

function normalizeCategoria(raw: string | null | undefined): CategoriaInventario {
  if (raw === 'Bebidas' || raw === 'Alimentos' || raw === 'Ingredientes' || raw === 'Otros') return raw;
  return 'Ingredientes';
}

function mapAlmacenError(msg: string): string {
  if (msg.includes('solo_gerente')) return 'Solo gerencia puede modificar el almacén.';
  if (msg.includes('cantidad_invalida_almacen')) return 'La cantidad de entrada debe ser mayor que cero.';
  if (msg.includes('cantidad_negativa')) return 'La cantidad ajustada no puede ser negativa.';
  if (msg.includes('ingrediente_no_encontrado')) return 'Ingrediente no encontrado.';
  return msg;
}

function stockStatus(r: Ingrediente): 'ok' | 'low' | 'critical' {
  const qty = Number(r.cantidad_disponible);
  const min = r.stock_minimo != null ? Number(r.stock_minimo) : null;
  if (min == null) return 'ok';
  if (qty <= 0) return 'critical';
  if (qty <= min) return 'low';
  return 'ok';
}

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8 }
    : { elevation: 4 };

export default function InventarioScreen() {
  const router = useRouter();
  const { session, staffMember, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Ingrediente[]>([]);
  const [movs, setMovs] = useState<MovRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<CategoriaInventario | 'todas'>('todas');

  const [entradaOpen, setEntradaOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [sel, setSel] = useState<Ingrediente | null>(null);
  const [cantStr, setCantStr] = useState('');
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setSchemaError(null);

    const movPromise = supabase
      .from('movimientos_almacen')
      .select('id, tipo, delta_cantidad, nota, creado_en, ingredientes ( nombre, unidad_medida )')
      .order('creado_en', { ascending: false })
      .limit(50);

    const ingPrimary = await supabase
      .from('ingredientes')
      .select('id, nombre, cantidad_disponible, unidad_medida, stock_minimo, categoria')
      .order('nombre');

    let ingError = ingPrimary.error;
    let ingData = ingPrimary.data as Ingrediente[] | null;

    if (ingError) {
      const m = ingError.message ?? '';
      const missingCategoria =
        m.includes('categoria') && (m.includes('does not exist') || m.includes('schema cache'));
      if (missingCategoria) {
        const fallback = await supabase
          .from('ingredientes')
          .select('id, nombre, cantidad_disponible, unidad_medida, stock_minimo')
          .order('nombre');
        ingError = fallback.error;
        ingData = (fallback.data ?? []).map((r) => ({
          ...r,
          categoria: 'Ingredientes' as CategoriaInventario,
        })) as Ingrediente[];
      }
    }

    const movRes = await movPromise;

    if (ingError) {
      const m = ingError.message ?? '';
      const missingTable =
        (m.includes('ingredientes') || m.includes("'public.ingredientes'")) &&
        (m.includes('does not exist') || m.includes('schema cache') || m.includes('Could not find the table'));
      if (missingTable && !m.includes('categoria')) {
        setSchemaError(
          'Falta el esquema de inventario en la base de datos. En Supabase SQL Editor ejecuta supabase/01_schema_bootstrap.sql (instalación completa) o supabase/README.md.',
        );
      } else if (m.includes('categoria')) {
        setSchemaError(
          'Falta la columna categoría en ingredientes. En Supabase SQL Editor ejecuta supabase/02_patch_inventario.sql (recomendado) o el bloque de migración en 01_schema_bootstrap.sql.',
        );
      } else {
        setSchemaError(m);
      }
      setRows([]);
      setMovs([]);
      return;
    }
    if (movRes.error) {
      setMovs([]);
    } else {
      setMovs((movRes.data as MovRow[]) ?? []);
    }
    setRows(
      (ingData ?? []).map((r) => ({
        ...r,
        unidad_medida: normalizeUnidadMedida(r.unidad_medida),
        categoria: normalizeCategoria(r.categoria ?? 'Ingredientes'),
      })),
    );
  }, []);

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

  const reloadRt = useCallback(() => load(), [load]);
  useSupabaseRealtimeRefresh(
    REALTIME_INVENTARIO,
    reloadRt,
    !!session && staffMember?.rol === 'gerente',
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const cat = normalizeCategoria(r.categoria ?? undefined);
      if (categoriaFilter !== 'todas' && cat !== categoriaFilter) return false;
      if (!normalizedQuery) return true;
      return (
        r.nombre.toLowerCase().includes(normalizedQuery) ||
        r.unidad_medida.toLowerCase().includes(normalizedQuery) ||
        etiquetaCampoCantidad(r.unidad_medida).toLowerCase().includes(normalizedQuery) ||
        cat.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [rows, categoriaFilter, normalizedQuery]);

  const lowStockCount = useMemo(
    () => rows.filter((r) => stockStatus(r) !== 'ok').length,
    [rows],
  );

  const openEntrada = (r: Ingrediente) => {
    setSel(r);
    setCantStr('');
    setNota('');
    setEntradaOpen(true);
  };

  const openAjuste = (r: Ingrediente) => {
    setSel(r);
    setCantStr(cantidadParaEdicion(r.cantidad_disponible, r.unidad_medida));
    setNota('');
    setAjusteOpen(true);
  };

  const submitEntrada = async () => {
    if (!sel) return;
    const parsed = parseCantidadInventario(cantStr, sel.unidad_medida);
    if (!parsed.ok) {
      Alert.alert('Cantidad', parsed.message);
      return;
    }
    const q = parsed.value;
    if (q <= 0) {
      Alert.alert('Cantidad', 'Indica una cantidad mayor que cero.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('gerente_almacen_entrada', {
        p_id_ingrediente: sel.id,
        p_cantidad: q,
        p_nota: nota.trim() || null,
      });
      if (error) {
        Alert.alert('Almacén', mapAlmacenError(error.message));
        return;
      }
      setEntradaOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const submitAjuste = async () => {
    if (!sel) return;
    const parsed = parseCantidadInventario(cantStr, sel.unidad_medida);
    if (!parsed.ok) {
      Alert.alert('Cantidad', parsed.message);
      return;
    }
    const q = parsed.value;
    if (q < 0) {
      Alert.alert('Cantidad', 'Indica la cantidad total disponible (número ≥ 0).');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('gerente_almacen_ajuste', {
        p_id_ingrediente: sel.id,
        p_nueva_cantidad: q,
        p_nota: nota.trim() || null,
      });
      if (error) {
        Alert.alert('Almacén', mapAlmacenError(error.message));
        return;
      }
      setAjusteOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={FtColors.accent} size="large" />
      </View>
    );
  }

  if (!session) {
    return null;
  }

  if (!staffMember) {
    return <Redirect href="/login" />;
  }

  if (staffMember.rol !== 'gerente') {
    return <Redirect href="/worker" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FtColors.accent} />
        }>
        <View style={styles.hero}>
          <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={FtColors.accent} />
            <Text style={styles.backText}>Gerencia</Text>
          </Pressable>
          <Text style={styles.heroEyebrow}>Solo gerente</Text>
          <Text style={styles.heroTitle}>Inventario</Text>
          <Text style={styles.heroSub}>
            Entradas de mercancía y ajustes físicos. Los pedidos de comensales descuentan stock según recetas.
          </Text>
        </View>

        {loading && !refreshing ? <ActivityIndicator color={FtColors.accent} style={styles.loader} /> : null}

        {!schemaError && rows.length > 0 ? (
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, cardShadow]}>
              <Text style={styles.kpiValue}>{rows.length}</Text>
              <Text style={styles.kpiLabel}>Productos</Text>
            </View>
            <View style={[styles.kpiCard, cardShadow]}>
              <Text style={[styles.kpiValue, lowStockCount > 0 && styles.kpiValueWarn]}>{lowStockCount}</Text>
              <Text style={styles.kpiLabel}>Stock bajo</Text>
            </View>
            <View style={[styles.kpiCard, cardShadow]}>
              <Text style={styles.kpiValue}>{filteredRows.length}</Text>
              <Text style={styles.kpiLabel}>Visibles</Text>
            </View>
          </View>
        ) : null}

        {!schemaError ? (
          <>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={20} color={FtColors.textFaint} style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar producto, unidad o categoría…"
                placeholderTextColor={FtColors.textFaint}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8} style={styles.searchClear}>
                  <Ionicons name="close-circle" size={20} color={FtColors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}>
              <Pressable
                style={[styles.filterChip, categoriaFilter === 'todas' && styles.filterChipOn]}
                onPress={() => setCategoriaFilter('todas')}>
                <Text style={[styles.filterChipText, categoriaFilter === 'todas' && styles.filterChipTextOn]}>
                  Todas
                </Text>
              </Pressable>
              {CATEGORIAS.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.filterChip, categoriaFilter === cat && styles.filterChipOn]}
                  onPress={() => setCategoriaFilter(cat)}>
                  <Ionicons
                    name={CATEGORIA_ICONS[cat]}
                    size={14}
                    color={categoriaFilter === cat ? FtColors.accent : FtColors.textMuted}
                  />
                  <Text style={[styles.filterChipText, categoriaFilter === cat && styles.filterChipTextOn]}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {schemaError ? (
          <View style={[styles.card, cardShadow]}>
            <Text style={styles.errText}>{schemaError}</Text>
          </View>
        ) : null}

        {!schemaError && rows.length === 0 && !loading ? (
          <Text style={styles.muted}>No hay ingredientes registrados.</Text>
        ) : null}

        {!schemaError && rows.length > 0 && filteredRows.length === 0 && !loading ? (
          <View style={[styles.emptyCard, cardShadow]}>
            <Ionicons name="filter-outline" size={28} color={FtColors.textFaint} />
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptySub}>Prueba otra búsqueda o cambia la categoría.</Text>
          </View>
        ) : null}

        {!schemaError
          ? filteredRows.map((r) => {
              const cat = normalizeCategoria(r.categoria ?? undefined);
              const status = stockStatus(r);
              return (
                <View key={r.id} style={[styles.productCard, cardShadow]}>
                  <View style={styles.productHead}>
                    <View style={styles.productIconWrap}>
                      <Ionicons name={CATEGORIA_ICONS[cat]} size={22} color={FtColors.accent} />
                    </View>
                    <View style={styles.productMeta}>
                      <Text style={styles.ingName} numberOfLines={2}>
                        {r.nombre}
                      </Text>
                      <View style={styles.tagRow}>
                        <View style={styles.catTag}>
                          <Text style={styles.catTagText}>{cat}</Text>
                        </View>
                        {status !== 'ok' ? (
                          <View style={[styles.stockTag, status === 'critical' && styles.stockTagCritical]}>
                            <Text
                              style={[
                                styles.stockTagText,
                                status === 'critical' && styles.stockTagTextCritical,
                              ]}>
                              {status === 'critical' ? 'Sin stock' : 'Stock bajo'}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.stockBlock}>
                    <Text style={styles.stockValue}>
                      {formatCantidadInventario(Number(r.cantidad_disponible), r.unidad_medida)}
                    </Text>
                    {r.stock_minimo != null ? (
                      <Text style={styles.stockMin}>
                        Mínimo · {formatCantidadInventario(Number(r.stock_minimo), r.unidad_medida)}
                      </Text>
                    ) : (
                      <Text style={styles.stockMin}>Sin mínimo configurado</Text>
                    )}
                  </View>

                  <View style={styles.rowBtns}>
                    <Pressable style={styles.btnSecondary} onPress={() => openEntrada(r)}>
                      <Ionicons name="add-circle-outline" size={18} color={FtColors.text} />
                      <Text style={styles.btnSecondaryText}>Entrada</Text>
                    </Pressable>
                    <Pressable style={styles.btnPrimary} onPress={() => openAjuste(r)}>
                      <Ionicons name="create-outline" size={18} color={FtColors.onAccent} />
                      <Text style={styles.btnPrimaryText}>Ajustar</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          : null}

        {!schemaError && movs.length > 0 ? (
          <View style={[styles.card, cardShadow, styles.movsCard]}>
            <View style={styles.sectionHead}>
              <Ionicons name="time-outline" size={20} color={FtColors.accentMuted} />
              <Text style={styles.cardTitle}>Últimos movimientos</Text>
            </View>
            {movs.map((m, idx) => (
              <View
                key={m.id}
                style={[styles.movRow, idx === movs.length - 1 && styles.movRowLast]}>
                <View style={styles.movTop}>
                  <Text style={styles.movLine}>{ingNombre(m.ingredientes)}</Text>
                  <View style={styles.movTipoBadge}>
                    <Text style={styles.movTipoText}>{m.tipo}</Text>
                  </View>
                </View>
                <Text style={styles.movDelta}>
                  {Number(m.delta_cantidad) >= 0 ? '+' : ''}
                  {formatCantidadInventario(Math.abs(Number(m.delta_cantidad)), ingUnidad(m.ingredientes))}
                </Text>
                {m.nota ? <Text style={styles.movNote}>{m.nota}</Text> : null}
                <Text style={styles.movDate}>
                  {new Date(m.creado_en).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={entradaOpen} animationType="fade" transparent onRequestClose={() => setEntradaOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !busy && setEntradaOpen(false)}>
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Entrada de almacén</Text>
            {sel ? <Text style={styles.modalSub}>{sel.nombre}</Text> : null}
            <Text style={styles.modalLabel}>
              Cantidad a sumar ({sel ? etiquetaCampoCantidad(sel.unidad_medida) : 'unidad'})
            </Text>
            <TextInput
              value={cantStr}
              onChangeText={setCantStr}
              keyboardType={sel ? tecladoCantidadInventario(sel.unidad_medida) : 'decimal-pad'}
              placeholder={sel ? placeholderCantidadInventario(sel.unidad_medida, false) : '0'}
              placeholderTextColor={FtColors.textMuted}
              style={styles.input}
            />
            <Text style={styles.modalLabel}>Nota (opcional)</Text>
            <TextInput
              value={nota}
              onChangeText={setNota}
              placeholder="Proveedor, lote…"
              placeholderTextColor={FtColors.textMuted}
              style={styles.input}
            />
            <Pressable style={[styles.modalOk, busy && styles.modalOkOff]} onPress={submitEntrada} disabled={busy}>
              <Text style={styles.modalOkText}>{busy ? 'Guardando…' : 'Registrar entrada'}</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={() => setEntradaOpen(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={ajusteOpen} animationType="fade" transparent onRequestClose={() => setAjusteOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !busy && setAjusteOpen(false)}>
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Ajuste de inventario</Text>
            {sel ? <Text style={styles.modalSub}>{sel.nombre}</Text> : null}
            <Text style={styles.modalLabel}>
              Cantidad total en almacén ({sel ? etiquetaCampoCantidad(sel.unidad_medida) : 'unidad'})
            </Text>
            <TextInput
              value={cantStr}
              onChangeText={setCantStr}
              keyboardType={sel ? tecladoCantidadInventario(sel.unidad_medida) : 'decimal-pad'}
              placeholder={sel ? placeholderCantidadInventario(sel.unidad_medida, true) : '0'}
              placeholderTextColor={FtColors.textMuted}
              style={styles.input}
            />
            <Text style={styles.modalLabel}>Nota (opcional)</Text>
            <TextInput
              value={nota}
              onChangeText={setNota}
              placeholder="Conteo físico…"
              placeholderTextColor={FtColors.textMuted}
              style={styles.input}
            />
            <Pressable style={[styles.modalOk, busy && styles.modalOkOff]} onPress={submitAjuste} disabled={busy}>
              <Text style={styles.modalOkText}>{busy ? 'Guardando…' : 'Guardar ajuste'}</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={() => setAjusteOpen(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FtColors.background },
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: FtColors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  loader: { marginVertical: 16 },
  hero: { marginBottom: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  backText: { fontSize: 15, fontWeight: '600', color: FtColors.accent },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: FtColors.accentMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: FtColors.text, marginTop: 4 },
  heroSub: { fontSize: 14, color: FtColors.textMuted, marginTop: 8, lineHeight: 20 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: FtColors.surfaceElevated,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 22, fontWeight: '800', color: FtColors.text },
  kpiValueWarn: { color: FtColors.warning },
  kpiLabel: { fontSize: 11, color: FtColors.textMuted, marginTop: 4, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FtColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FtColors.border,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: FtColors.text,
  },
  searchClear: { padding: 4 },
  filterRow: { gap: 8, marginBottom: 16, paddingRight: 4 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FtColors.border,
    backgroundColor: FtColors.surface,
  },
  filterChipOn: { borderColor: FtColors.accent, backgroundColor: FtColors.surfaceElevated },
  filterChipText: { fontSize: 12, color: FtColors.textMuted, fontWeight: '600' },
  filterChipTextOn: { color: FtColors.accent, fontWeight: '700' },
  muted: { color: FtColors.textMuted, marginBottom: 12, fontSize: 14 },
  errText: { color: FtColors.danger, fontSize: 14, lineHeight: 20 },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: FtColors.surfaceElevated,
    borderWidth: 1,
    borderColor: FtColors.border,
    marginBottom: 14,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: FtColors.text },
  emptySub: { fontSize: 13, color: FtColors.textMuted, textAlign: 'center' },
  productCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: FtColors.surfaceElevated,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
    marginBottom: 12,
  },
  productHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  productIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productMeta: { flex: 1 },
  ingName: { fontSize: 17, fontWeight: '800', color: FtColors.text, lineHeight: 22 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  catTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
  },
  catTagText: { fontSize: 11, fontWeight: '600', color: FtColors.accentMuted },
  stockTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(240, 189, 115, 0.15)',
  },
  stockTagCritical: { backgroundColor: 'rgba(228, 127, 158, 0.15)' },
  stockTagText: { fontSize: 11, fontWeight: '700', color: FtColors.warning },
  stockTagTextCritical: { color: FtColors.danger },
  stockBlock: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
  },
  stockValue: { fontSize: 22, fontWeight: '800', color: FtColors.text },
  stockMin: { fontSize: 12, color: FtColors.textFaint, marginTop: 4 },
  rowBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FtColors.border,
    backgroundColor: FtColors.surface,
  },
  btnSecondaryText: { fontWeight: '700', color: FtColors.text, fontSize: 14 },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: FtColors.accent,
  },
  btnPrimaryText: { fontWeight: '700', color: FtColors.onAccent, fontSize: 14 },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: FtColors.surfaceElevated,
    borderWidth: 1,
    borderColor: FtColors.border,
    marginBottom: 14,
  },
  movsCard: { marginTop: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: FtColors.text },
  movRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: FtColors.borderSubtle },
  movRowLast: { marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 },
  movTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  movLine: { fontSize: 14, color: FtColors.text, fontWeight: '700', flex: 1 },
  movTipoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
  },
  movTipoText: { fontSize: 10, fontWeight: '700', color: FtColors.textMuted, textTransform: 'uppercase' },
  movDelta: { fontSize: 15, fontWeight: '800', color: FtColors.accent, marginTop: 6 },
  movNote: { fontSize: 12, color: FtColors.textMuted, marginTop: 4 },
  movDate: { fontSize: 11, color: FtColors.textFaint, marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: FtColors.surfaceElevated,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: FtColors.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: FtColors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: FtColors.text },
  modalSub: { fontSize: 14, color: FtColors.textMuted, marginTop: 6 },
  modalLabel: { fontSize: 12, color: FtColors.textFaint, marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: FtColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: FtColors.text,
    fontSize: 16,
    backgroundColor: FtColors.surface,
  },
  modalOk: {
    marginTop: 18,
    backgroundColor: FtColors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalOkOff: { opacity: 0.6 },
  modalOkText: { fontWeight: '800', color: FtColors.onAccent },
  modalCancel: { textAlign: 'center', marginTop: 14, color: FtColors.accent, fontWeight: '600' },
});
