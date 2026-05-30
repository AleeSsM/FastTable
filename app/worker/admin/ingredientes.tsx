import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { AuthBoot } from '@/components/auth-boot';

import { adminCardShadow, adminStyles } from '@/constants/worker-admin-styles';
import { FtColors } from '@/constants/fasttable';
import { REALTIME_ADMIN, useSupabaseRealtimeRefresh } from '@/hooks/use-supabase-realtime-refresh';
import {
  etiquetaCampoCantidad,
  formatCantidadInventario,
  normalizeUnidadMedida,
  parseCantidadInventario,
  placeholderCantidadInventario,
  tecladoCantidadInventario,
  type UnidadMedidaInventario,
} from '@/lib/format';
import { useGerenteGuardNavigation } from '@/hooks/use-gerente-guard-navigation';
import { supabase } from '@/lib/supabase';

type CategoriaInventario = 'Bebidas' | 'Alimentos' | 'Ingredientes' | 'Otros';

type IngredienteRow = {
  id: string;
  nombre: string;
  cantidad_disponible: number;
  unidad_medida: UnidadMedidaInventario;
  stock_minimo: number | null;
  categoria: CategoriaInventario;
};

const CATEGORIAS: readonly CategoriaInventario[] = ['Bebidas', 'Alimentos', 'Ingredientes', 'Otros'] as const;
const UNIDADES: readonly UnidadMedidaInventario[] = ['g', 'ml', 'piezas', 'unidades'] as const;

const CATEGORIA_ICONS: Record<CategoriaInventario, ComponentProps<typeof Ionicons>['name']> = {
  Bebidas: 'wine-outline',
  Alimentos: 'restaurant-outline',
  Ingredientes: 'leaf-outline',
  Otros: 'cube-outline',
};

function normalizeCategoria(raw: string | null | undefined): CategoriaInventario {
  if (raw === 'Bebidas' || raw === 'Alimentos' || raw === 'Ingredientes' || raw === 'Otros') return raw;
  return 'Ingredientes';
}

function unidadLabel(u: UnidadMedidaInventario): string {
  switch (u) {
    case 'g':
      return 'Gramos (g)';
    case 'ml':
      return 'Mililitros (ml)';
    case 'piezas':
      return 'Piezas';
    case 'unidades':
      return 'Unidades';
    default:
      return u;
  }
}

export default function AdminIngredientesScreen() {
  const guard = useGerenteGuardNavigation();
  const [rows, setRows] = useState<IngredienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<CategoriaInventario | 'todas'>('todas');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IngredienteRow | null>(null);
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState<UnidadMedidaInventario>('g');
  const [categoria, setCategoria] = useState<CategoriaInventario>('Ingredientes');
  const [stockStr, setStockStr] = useState('0');
  const [minStr, setMinStr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('ingredientes')
      .select('id, nombre, cantidad_disponible, unidad_medida, stock_minimo, categoria')
      .order('nombre');
    if (error) {
      Alert.alert('Error', error.message);
      setRows([]);
      return;
    }
    setRows(
      ((data as IngredienteRow[]) ?? []).map((r) => ({
        ...r,
        unidad_medida: normalizeUnidadMedida(r.unidad_medida),
        categoria: normalizeCategoria(r.categoria),
      })),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!guard.boot) return;
      let alive = true;
      setLoading(true);
      load().finally(() => {
        if (alive) setLoading(false);
      });
      return () => {
        alive = false;
      };
    }, [guard.boot, load]),
  );

  useSupabaseRealtimeRefresh(REALTIME_ADMIN, load, guard.boot);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoriaFilter !== 'todas' && r.categoria !== categoriaFilter) return false;
      if (!q) return true;
      return r.nombre.toLowerCase().includes(q);
    });
  }, [rows, searchQuery, categoriaFilter]);

  const openCreate = () => {
    setEditing(null);
    setNombre('');
    setUnidad('g');
    setCategoria('Ingredientes');
    setStockStr('0');
    setMinStr('');
    setModalOpen(true);
  };

  const openEdit = (r: IngredienteRow) => {
    setEditing(r);
    setNombre(r.nombre);
    setUnidad(r.unidad_medida);
    setCategoria(r.categoria);
    setStockStr(String(r.cantidad_disponible));
    setMinStr(r.stock_minimo != null ? String(r.stock_minimo) : '');
    setModalOpen(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const save = async () => {
    const name = nombre.trim();
    if (!name) {
      Alert.alert('Nombre', 'Indica el nombre del ingrediente.');
      return;
    }
    const stockParsed = parseCantidadInventario(stockStr, unidad);
    if (!stockParsed.ok) {
      Alert.alert('Stock', stockParsed.message);
      return;
    }
    let stockMin: number | null = null;
    if (minStr.trim()) {
      const minParsed = parseCantidadInventario(minStr, unidad);
      if (!minParsed.ok) {
        Alert.alert('Stock mínimo', minParsed.message);
        return;
      }
      stockMin = minParsed.value;
    }
    setBusy(true);
    const payload = {
      nombre: name,
      unidad_medida: unidad,
      categoria,
      cantidad_disponible: stockParsed.value,
      stock_minimo: stockMin,
    };
    if (editing) {
      const { error } = await supabase.from('ingredientes').update(payload).eq('id', editing.id);
      setBusy(false);
      if (error) {
        Alert.alert('No se pudo guardar', error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('ingredientes').insert(payload);
      setBusy(false);
      if (error) {
        Alert.alert('No se pudo crear', error.message);
        return;
      }
    }
    setModalOpen(false);
    await load();
  };

  const confirmDelete = (r: IngredienteRow) => {
    Alert.alert(
      'Eliminar ingrediente',
      `¿Eliminar "${r.nombre}"? No se puede si está en recetas de platillos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('ingredientes').delete().eq('id', r.id);
            if (error) {
              Alert.alert(
                'No se pudo eliminar',
                error.message.includes('violates foreign key')
                  ? 'Este ingrediente está en una o más recetas. Quítalo de los platillos primero.'
                  : error.message,
              );
              return;
            }
            await load();
          },
        },
      ],
    );
  };

  if (guard.boot === false || guard.redirectHref) {
    return <AuthBoot variant="worker" />;
  }

  return (
    <SafeAreaView style={adminStyles.safe} edges={['bottom']}>
      <ScrollView
        style={adminStyles.scroll}
        contentContainerStyle={adminStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FtColors.accent} />}>
        <View style={adminStyles.searchWrap}>
          <Ionicons name="search" size={18} color={FtColors.textMuted} style={adminStyles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar ingrediente…"
            placeholderTextColor={FtColors.textMuted}
            style={adminStyles.searchInput}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} style={adminStyles.searchClear}>
              <Ionicons name="close-circle" size={20} color={FtColors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={adminStyles.filterRow}>
          <Pressable
            style={[adminStyles.filterChip, categoriaFilter === 'todas' && adminStyles.filterChipOn]}
            onPress={() => setCategoriaFilter('todas')}>
            <Text
              style={[adminStyles.filterChipText, categoriaFilter === 'todas' && adminStyles.filterChipTextOn]}>
              Todas
            </Text>
          </Pressable>
          {CATEGORIAS.map((c) => (
            <Pressable
              key={c}
              style={[adminStyles.filterChip, categoriaFilter === c && adminStyles.filterChipOn]}
              onPress={() => setCategoriaFilter(c)}>
              <Ionicons
                name={CATEGORIA_ICONS[c]}
                size={14}
                color={categoriaFilter === c ? FtColors.accent : FtColors.textMuted}
              />
              <Text style={[adminStyles.filterChipText, categoriaFilter === c && adminStyles.filterChipTextOn]}>
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={FtColors.accent} style={adminStyles.loader} />
        ) : filtered.length === 0 ? (
          <View style={adminStyles.emptyCard}>
            <Ionicons name="leaf-outline" size={32} color={FtColors.textMuted} />
            <Text style={adminStyles.emptyTitle}>Sin ingredientes</Text>
            <Text style={adminStyles.emptySub}>Registra insumos para usarlos al crear platillos.</Text>
          </View>
        ) : (
          filtered.map((r) => (
            <View key={r.id} style={[adminStyles.card, adminCardShadow]}>
              <Text style={adminStyles.cardTitle}>{r.nombre}</Text>
              <Text style={adminStyles.cardSub}>
                {formatCantidadInventario(Number(r.cantidad_disponible), r.unidad_medida)}
                {r.stock_minimo != null
                  ? ` · mín. ${formatCantidadInventario(Number(r.stock_minimo), r.unidad_medida)}`
                  : ''}
              </Text>
              <View style={adminStyles.tagRow}>
                <View style={[adminStyles.estadoTag, { backgroundColor: FtColors.surface }]}>
                  <Text style={[adminStyles.estadoTagText, { color: FtColors.accentMuted }]}>{r.categoria}</Text>
                </View>
                <View style={[adminStyles.estadoTag, { backgroundColor: FtColors.surface }]}>
                  <Text style={[adminStyles.estadoTagText, { color: FtColors.textMuted }]}>{r.unidad_medida}</Text>
                </View>
              </View>
              <View style={adminStyles.cardActions}>
                <Pressable style={adminStyles.btnIcon} onPress={() => openEdit(r)}>
                  <Ionicons name="create-outline" size={18} color={FtColors.accent} />
                  <Text style={adminStyles.btnIconText}>Editar</Text>
                </Pressable>
                <Pressable
                  style={[adminStyles.btnIcon, adminStyles.btnIconDanger]}
                  onPress={() => confirmDelete(r)}>
                  <Ionicons name="trash-outline" size={18} color={FtColors.danger} />
                  <Text style={[adminStyles.btnIconText, adminStyles.btnIconTextDanger]}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable style={adminStyles.fab} onPress={openCreate} accessibilityLabel="Nuevo ingrediente">
        <Ionicons name="add" size={28} color={FtColors.onAccent} />
      </Pressable>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => !busy && setModalOpen(false)}>
        <Pressable style={adminStyles.modalBackdrop} onPress={() => !busy && setModalOpen(false)}>
          <View style={adminStyles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={adminStyles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={adminStyles.modalTitle}>{editing ? 'Editar ingrediente' : 'Nuevo ingrediente'}</Text>
              <Text style={adminStyles.modalLabel}>Nombre</Text>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Carne, pan, queso…"
                placeholderTextColor={FtColors.textMuted}
                style={adminStyles.input}
              />
              <Text style={adminStyles.modalLabel}>Unidad de medida</Text>
              <View style={adminStyles.chipRow}>
                {UNIDADES.map((u) => (
                  <Pressable
                    key={u}
                    style={[adminStyles.chip, unidad === u && adminStyles.chipOn]}
                    onPress={() => setUnidad(u)}>
                    <Text style={[adminStyles.chipText, unidad === u && adminStyles.chipTextOn]}>
                      {unidadLabel(u)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={adminStyles.modalLabel}>Categoría</Text>
              <View style={adminStyles.chipRow}>
                {CATEGORIAS.map((c) => (
                  <Pressable
                    key={c}
                    style={[adminStyles.chip, categoria === c && adminStyles.chipOn]}
                    onPress={() => setCategoria(c)}>
                    <Text style={[adminStyles.chipText, categoria === c && adminStyles.chipTextOn]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={adminStyles.modalLabel}>
                Stock {editing ? 'actual' : 'inicial'} ({etiquetaCampoCantidad(unidad)})
              </Text>
              <TextInput
                value={stockStr}
                onChangeText={setStockStr}
                keyboardType={tecladoCantidadInventario(unidad)}
                placeholder={placeholderCantidadInventario(unidad, true)}
                placeholderTextColor={FtColors.textMuted}
                style={adminStyles.input}
              />
              <Text style={adminStyles.modalLabel}>Stock mínimo (opcional)</Text>
              <TextInput
                value={minStr}
                onChangeText={setMinStr}
                keyboardType={tecladoCantidadInventario(unidad)}
                placeholder={placeholderCantidadInventario(unidad, false)}
                placeholderTextColor={FtColors.textMuted}
                style={adminStyles.input}
              />
              <Pressable style={[adminStyles.modalOk, busy && adminStyles.modalOkOff]} onPress={save} disabled={busy}>
                <Text style={adminStyles.modalOkText}>{busy ? 'Guardando…' : 'Guardar'}</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => setModalOpen(false)}>
                <Text style={adminStyles.modalCancel}>Cancelar</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
