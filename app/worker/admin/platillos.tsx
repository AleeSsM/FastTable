import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { AuthBoot } from '@/components/auth-boot';

import { adminCardShadow, adminStyles } from '@/constants/worker-admin-styles';
import { AcColors, AcSurfaces } from '@/constants/alacarta';
import { REALTIME_ADMIN, useSupabaseRealtimeRefresh } from '@/hooks/use-supabase-realtime-refresh';
import { centavosToPrecioInput, parsePrecioPesosToCentavos } from '@/lib/admin-price';
import { formatPriceFromCents, formatCantidadInventario, parseCantidadInventario, etiquetaCampoCantidad, tecladoCantidadInventario, placeholderCantidadInventario } from '@/lib/format';
import { useGerenteGuardNavigation } from '@/hooks/use-gerente-guard-navigation';
import { supabase } from '@/lib/supabase';

type Categoria = { id: string; nombre: string };
type IngredienteOpt = { id: string; nombre: string; unidad_medida: string };

type PlatilloRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_centavos: number;
  disponible: boolean;
  sin_stock: boolean;
  imagen_url: string | null;
  id_categoria: string;
  categorias_menu: { nombre: string } | { nombre: string }[] | null;
};

type RecipeLine = {
  key: string;
  id_ingrediente: string;
  nombre: string;
  unidad_medida: string;
  cantidadStr: string;
};

function catNombre(c: PlatilloRow['categorias_menu']): string {
  if (!c) return '—';
  const z = Array.isArray(c) ? c[0] : c;
  return z?.nombre ?? '—';
}

export default function AdminPlatillosScreen() {
  const guard = useGerenteGuardNavigation();
  const [platillos, setPlatillos] = useState<PlatilloRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ingredientes, setIngredientes] = useState<IngredienteOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<PlatilloRow | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precioStr, setPrecioStr] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [idCategoria, setIdCategoria] = useState<string | null>(null);
  const [disponible, setDisponible] = useState(true);
  const [recipe, setRecipe] = useState<RecipeLine[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [itemsRes, catRes, ingRes] = await Promise.all([
      supabase
        .from('items_menu')
        .select(
          'id, nombre, descripcion, precio_centavos, disponible, sin_stock, imagen_url, id_categoria, categorias_menu ( nombre )',
        )
        .order('nombre'),
      supabase.from('categorias_menu').select('id, nombre').order('orden'),
      supabase.from('ingredientes').select('id, nombre, unidad_medida').order('nombre'),
    ]);
    if (itemsRes.error) {
      Alert.alert('Error', itemsRes.error.message);
      setPlatillos([]);
    } else {
      setPlatillos((itemsRes.data as PlatilloRow[]) ?? []);
    }
    if (!catRes.error) setCategorias((catRes.data as Categoria[]) ?? []);
    if (!ingRes.error) setIngredientes((ingRes.data as IngredienteOpt[]) ?? []);
  }, []);

  const loadRecipe = useCallback(async (idItem: string) => {
    const { data: receta, error: recErr } = await supabase
      .from('recetas')
      .select('id')
      .eq('id_item_menu', idItem)
      .maybeSingle();
    if (recErr || !receta) {
      setRecipe([]);
      return;
    }
    const { data: lines, error: lineErr } = await supabase
      .from('receta_ingredientes')
      .select('id, id_ingrediente, cantidad_por_plato, ingredientes ( nombre, unidad_medida )')
      .eq('id_receta', receta.id);
    if (lineErr || !lines) {
      setRecipe([]);
      return;
    }
    setRecipe(
      lines.map((row) => {
        const ing = Array.isArray(row.ingredientes) ? row.ingredientes[0] : row.ingredientes;
        const unidad = ing?.unidad_medida ?? 'g';
        return {
          key: row.id,
          id_ingrediente: row.id_ingrediente,
          nombre: ing?.nombre ?? '—',
          unidad_medida: unidad,
          cantidadStr: String(row.cantidad_por_plato),
        };
      }),
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
    if (!q) return platillos;
    return platillos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        catNombre(p.categorias_menu).toLowerCase().includes(q),
    );
  }, [platillos, searchQuery]);

  const ingredientesDisponiblesPicker = useMemo(() => {
    const used = new Set(recipe.map((r) => r.id_ingrediente));
    const q = pickerSearch.trim().toLowerCase();
    return ingredientes.filter((i) => {
      if (used.has(i.id)) return false;
      if (!q) return true;
      return i.nombre.toLowerCase().includes(q);
    });
  }, [ingredientes, recipe, pickerSearch]);

  const openCreate = () => {
    setEditing(null);
    setNombre('');
    setDescripcion('');
    setPrecioStr('');
    setImagenUrl('');
    setIdCategoria(categorias[0]?.id ?? null);
    setDisponible(true);
    setRecipe([]);
    setModalOpen(true);
  };

  const openEdit = async (p: PlatilloRow) => {
    setEditing(p);
    setNombre(p.nombre);
    setDescripcion(p.descripcion ?? '');
    setPrecioStr(centavosToPrecioInput(p.precio_centavos));
    setImagenUrl(p.imagen_url ?? '');
    setIdCategoria(p.id_categoria);
    setDisponible(p.disponible);
    setModalOpen(true);
    await loadRecipe(p.id);
  };

  const addIngredient = (ing: IngredienteOpt) => {
    setRecipe((prev) => [
      ...prev,
      {
        key: `new-${ing.id}-${Date.now()}`,
        id_ingrediente: ing.id,
        nombre: ing.nombre,
        unidad_medida: ing.unidad_medida,
        cantidadStr: ing.unidad_medida === 'g' || ing.unidad_medida === 'ml' ? '1' : '1',
      },
    ]);
    setPickerOpen(false);
  };

  const removeLine = (key: string) => {
    setRecipe((prev) => prev.filter((l) => l.key !== key));
  };

  const updateLineQty = (key: string, cantidadStr: string) => {
    setRecipe((prev) => prev.map((l) => (l.key === key ? { ...l, cantidadStr } : l)));
  };

  const save = async () => {
    const name = nombre.trim();
    if (!name) {
      Alert.alert('Nombre', 'Indica el nombre del platillo.');
      return;
    }
    if (!idCategoria) {
      Alert.alert('Categoría', 'Selecciona una categoría del menú.');
      return;
    }
    const precio = parsePrecioPesosToCentavos(precioStr);
    if (!precio.ok) {
      Alert.alert('Precio', 'Indica un precio válido en pesos (ej. 89.50).');
      return;
    }
    const parsedLines: { id_ingrediente: string; cantidad: number }[] = [];
    for (const line of recipe) {
      const parsed = parseCantidadInventario(line.cantidadStr, line.unidad_medida);
      if (!parsed.ok) {
        Alert.alert('Receta', `${line.nombre}: ${parsed.message}`);
        return;
      }
      if (parsed.value <= 0) {
        Alert.alert('Receta', `${line.nombre}: la cantidad debe ser mayor que cero.`);
        return;
      }
      parsedLines.push({ id_ingrediente: line.id_ingrediente, cantidad: parsed.value });
    }

    setBusy(true);
    const itemPayload = {
      nombre: name,
      descripcion: descripcion.trim() || null,
      precio_centavos: precio.cents,
      imagen_url: imagenUrl.trim() || null,
      id_categoria: idCategoria,
      disponible,
    };

    let itemId = editing?.id;
    if (editing) {
      const { error } = await supabase.from('items_menu').update(itemPayload).eq('id', editing.id);
      if (error) {
        setBusy(false);
        Alert.alert('No se pudo guardar', error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from('items_menu').insert(itemPayload).select('id').single();
      if (error || !data) {
        setBusy(false);
        Alert.alert('No se pudo crear', error?.message ?? 'Error desconocido');
        return;
      }
      itemId = data.id;
    }

    if (!itemId) {
      setBusy(false);
      return;
    }

    let recetaId: string | null = null;
    const { data: existingReceta } = await supabase
      .from('recetas')
      .select('id')
      .eq('id_item_menu', itemId)
      .maybeSingle();
    if (existingReceta?.id) {
      recetaId = existingReceta.id;
    } else if (parsedLines.length > 0) {
      const { data: newRec, error: recErr } = await supabase
        .from('recetas')
        .insert({ id_item_menu: itemId })
        .select('id')
        .single();
      if (recErr || !newRec) {
        setBusy(false);
        Alert.alert('Receta', recErr?.message ?? 'No se pudo crear la receta');
        return;
      }
      recetaId = newRec.id;
    }

    if (recetaId) {
      await supabase.from('receta_ingredientes').delete().eq('id_receta', recetaId);
      if (parsedLines.length > 0) {
        const { error: riErr } = await supabase.from('receta_ingredientes').insert(
          parsedLines.map((l) => ({
            id_receta: recetaId!,
            id_ingrediente: l.id_ingrediente,
            cantidad_por_plato: l.cantidad,
          })),
        );
        if (riErr) {
          setBusy(false);
          Alert.alert('Ingredientes de receta', riErr.message);
          return;
        }
      }
    }

    setBusy(false);
    setModalOpen(false);
    await load();
  };

  const confirmDelete = (p: PlatilloRow) => {
    Alert.alert('Eliminar platillo', `¿Eliminar "${p.nombre}" del menú?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('items_menu').delete().eq('id', p.id);
          if (error) {
            Alert.alert('No se pudo eliminar', error.message);
            return;
          }
          await load();
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (guard.boot === false || guard.redirectHref) {
    return <AuthBoot variant="worker" />;
  }

  return (
    <SafeAreaView style={adminStyles.safe} edges={['bottom']}>
      <ScrollView
        style={adminStyles.scroll}
        contentContainerStyle={adminStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AcColors.accent} />}>
        <View style={adminStyles.searchWrap}>
          <Ionicons name="search" size={18} color={AcColors.textMuted} style={adminStyles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar platillo o categoría…"
            placeholderTextColor={AcColors.textMuted}
            style={adminStyles.searchInput}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={AcColors.accent} style={adminStyles.loader} />
        ) : filtered.length === 0 ? (
          <View style={adminStyles.emptyCard}>
            <Ionicons name="fast-food-outline" size={32} color={AcColors.textMuted} />
            <Text style={adminStyles.emptyTitle}>Sin platillos</Text>
            <Text style={adminStyles.emptySub}>Crea platillos y asigna ingredientes de tu catálogo.</Text>
          </View>
        ) : (
          filtered.map((p) => (
            <View key={p.id} style={[adminStyles.card, adminCardShadow]}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {p.imagen_url ? (
                  <Image source={{ uri: p.imagen_url }} style={adminStyles.dishThumb} resizeMode="cover" />
                ) : (
                  <View style={[adminStyles.dishThumb, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="image-outline" size={24} color={AcColors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={adminStyles.cardTitle}>{p.nombre}</Text>
                  <Text style={adminStyles.cardSub}>
                    {formatPriceFromCents(p.precio_centavos)} · {catNombre(p.categorias_menu)}
                  </Text>
                  <View style={adminStyles.tagRow}>
                    {!p.disponible ? (
                      <View style={[adminStyles.estadoTag, { backgroundColor: AcSurfaces.dangerSoft }]}>
                        <Text style={[adminStyles.estadoTagText, { color: AcColors.danger }]}>No disponible</Text>
                      </View>
                    ) : null}
                    {p.sin_stock ? (
                      <View style={[adminStyles.estadoTag, { backgroundColor: AcSurfaces.warningSoft }]}>
                        <Text style={[adminStyles.estadoTagText, { color: AcColors.warning }]}>Sin stock</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
              <View style={adminStyles.cardActions}>
                <Pressable style={adminStyles.btnIcon} onPress={() => void openEdit(p)}>
                  <Ionicons name="create-outline" size={18} color={AcColors.accent} />
                  <Text style={adminStyles.btnIconText}>Editar</Text>
                </Pressable>
                <Pressable
                  style={[adminStyles.btnIcon, adminStyles.btnIconDanger]}
                  onPress={() => confirmDelete(p)}>
                  <Ionicons name="trash-outline" size={18} color={AcColors.danger} />
                  <Text style={[adminStyles.btnIconText, adminStyles.btnIconTextDanger]}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable style={adminStyles.fab} onPress={openCreate} accessibilityLabel="Nuevo platillo">
        <Ionicons name="add" size={28} color={AcColors.onAccent} />
      </Pressable>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => !busy && setModalOpen(false)}>
        <Pressable style={adminStyles.modalBackdrop} onPress={() => !busy && setModalOpen(false)}>
          <View style={adminStyles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={adminStyles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '100%' }}>
              <Text style={adminStyles.modalTitle}>{editing ? 'Editar platillo' : 'Nuevo platillo'}</Text>

              <Text style={adminStyles.modalLabel}>Nombre</Text>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                style={adminStyles.input}
                placeholder="Hamburguesa clásica"
                placeholderTextColor={AcColors.textMuted}
              />

              <Text style={adminStyles.modalLabel}>Precio (MXN)</Text>
              <TextInput
                value={precioStr}
                onChangeText={setPrecioStr}
                keyboardType="decimal-pad"
                placeholder="89.00"
                placeholderTextColor={AcColors.textMuted}
                style={adminStyles.input}
              />

              <Text style={adminStyles.modalLabel}>Categoría</Text>
              <View style={adminStyles.chipRow}>
                {categorias.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[adminStyles.chip, idCategoria === c.id && adminStyles.chipOn]}
                    onPress={() => setIdCategoria(c.id)}>
                    <Text style={[adminStyles.chipText, idCategoria === c.id && adminStyles.chipTextOn]}>
                      {c.nombre}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={adminStyles.modalLabel}>Descripción (opcional)</Text>
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                style={[adminStyles.input, adminStyles.inputMultiline]}
                multiline
                placeholderTextColor={AcColors.textMuted}
              />

              <Text style={adminStyles.modalLabel}>URL de imagen (opcional)</Text>
              <TextInput
                value={imagenUrl}
                onChangeText={setImagenUrl}
                style={adminStyles.input}
                placeholder="https://…"
                placeholderTextColor={AcColors.textMuted}
                autoCapitalize="none"
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <Text style={[adminStyles.modalLabel, { marginTop: 0 }]}>Disponible en menú</Text>
                <Switch
                  value={disponible}
                  onValueChange={setDisponible}
                  trackColor={{ false: AcColors.border, true: AcColors.accentMuted }}
                  thumbColor={AcColors.text}
                />
              </View>

              <Text style={[adminStyles.modalTitle, { marginTop: 20, fontSize: 16 }]}>Receta (ingredientes registrados)</Text>
              <Text style={adminStyles.modalSub}>
                Solo puedes elegir ingredientes del catálogo. Indica la cantidad por plato en la unidad de cada
                ingrediente.
              </Text>

              {recipe.map((line) => (
                <View key={line.key} style={adminStyles.recipeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={adminStyles.recipeName}>{line.nombre}</Text>
                    <Text style={adminStyles.modalSub}>{etiquetaCampoCantidad(line.unidad_medida)}</Text>
                  </View>
                  <TextInput
                    value={line.cantidadStr}
                    onChangeText={(t) => updateLineQty(line.key, t)}
                    keyboardType={tecladoCantidadInventario(line.unidad_medida)}
                    placeholder={placeholderCantidadInventario(line.unidad_medida, false)}
                    placeholderTextColor={AcColors.textMuted}
                    style={[adminStyles.input, adminStyles.recipeQty, { marginTop: 0 }]}
                  />
                  <Pressable onPress={() => removeLine(line.key)} style={adminStyles.recipeRemove}>
                    <Ionicons name="close-circle" size={22} color={AcColors.danger} />
                  </Pressable>
                </View>
              ))}

              {ingredientes.length === 0 ? (
                <Text style={adminStyles.muted}>
                  No hay ingredientes. Créalos en Administración → Ingredientes.
                </Text>
              ) : (
                <Pressable
                  style={adminStyles.addIngBtn}
                  onPress={() => {
                    setPickerSearch('');
                    setPickerOpen(true);
                  }}>
                  <Ionicons name="add-circle-outline" size={20} color={AcColors.accent} />
                  <Text style={adminStyles.addIngBtnText}>Agregar ingrediente</Text>
                </Pressable>
              )}

              {recipe.length > 0 ? (
                <Text style={[adminStyles.modalSub, { marginTop: 8 }]}>
                  Vista previa:{' '}
                  {recipe
                    .map((l) => {
                      const p = parseCantidadInventario(l.cantidadStr, l.unidad_medida);
                      const qty = p.ok ? formatCantidadInventario(p.value, l.unidad_medida) : '…';
                      return `${l.nombre} (${qty})`;
                    })
                    .join(' · ')}
                </Text>
              ) : null}

              <Pressable style={[adminStyles.modalOk, busy && adminStyles.modalOkOff]} onPress={() => void save()} disabled={busy}>
                <Text style={adminStyles.modalOkText}>{busy ? 'Guardando…' : 'Guardar platillo'}</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => setModalOpen(false)}>
                <Text style={adminStyles.modalCancel}>Cancelar</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={pickerOpen} animationType="fade" transparent onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={adminStyles.modalBackdropCenter} onPress={() => setPickerOpen(false)}>
          <View style={adminStyles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={adminStyles.modalTitle}>Elegir ingrediente</Text>
            <TextInput
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Buscar…"
              placeholderTextColor={AcColors.textMuted}
              style={[adminStyles.input, { marginTop: 10 }]}
            />
            <ScrollView style={{ maxHeight: 360, marginTop: 8 }}>
              {ingredientesDisponiblesPicker.length === 0 ? (
                <Text style={adminStyles.muted}>No hay más ingredientes disponibles o el catálogo está vacío.</Text>
              ) : (
                ingredientesDisponiblesPicker.map((ing) => (
                  <Pressable key={ing.id} style={adminStyles.pickerRow} onPress={() => addIngredient(ing)}>
                    <View style={{ flex: 1 }}>
                      <Text style={adminStyles.pickerRowText}>{ing.nombre}</Text>
                      <Text style={adminStyles.pickerRowSub}>{ing.unidad_medida}</Text>
                    </View>
                    <Ionicons name="add" size={22} color={AcColors.accent} />
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable onPress={() => setPickerOpen(false)}>
              <Text style={adminStyles.modalCancel}>Cerrar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
