import { Ionicons } from '@expo/vector-icons';
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

import { adminCardShadow, adminStyles, estadoMesaStyle } from '@/constants/worker-admin-styles';
import { AcColors } from '@/constants/alacarta';
import { REALTIME_ADMIN, useSupabaseRealtimeRefresh } from '@/hooks/use-supabase-realtime-refresh';
import { mapAdminSupabaseError } from '@/lib/admin-errors';
import { mesaEtiqueta } from '@/lib/mesa-label';
import { useGerenteGuardNavigation } from '@/hooks/use-gerente-guard-navigation';
import { supabase } from '@/lib/supabase';

type EstadoMesa = 'libre' | 'ocupada' | 'reservada';

type MesaRow = {
  id: string;
  codigo: string;
  capacidad: number;
  estado: EstadoMesa;
  descripcion_publica: string | null;
  notas: string | null;
};

const ESTADOS: readonly EstadoMesa[] = ['libre', 'ocupada', 'reservada'] as const;

export default function AdminMesasScreen() {
  const guard = useGerenteGuardNavigation();
  const [rows, setRows] = useState<MesaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MesaRow | null>(null);
  const [codigo, setCodigo] = useState('');
  const [capacidadStr, setCapacidadStr] = useState('4');
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas] = useState('');
  const [estado, setEstado] = useState<EstadoMesa>('libre');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('mesas')
      .select('id, codigo, capacidad, estado, descripcion_publica, notas')
      .order('codigo');
    if (error) {
      Alert.alert('Error', error.message);
      setRows([]);
      return;
    }
    setRows((data as MesaRow[]) ?? []);
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
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.codigo.toLowerCase().includes(q) ||
        (r.descripcion_publica?.toLowerCase().includes(q) ?? false),
    );
  }, [rows, searchQuery]);

  const openCreate = () => {
    setEditing(null);
    setCodigo('');
    setCapacidadStr('4');
    setDescripcion('');
    setNotas('');
    setEstado('libre');
    setModalOpen(true);
  };

  const openEdit = (m: MesaRow) => {
    setEditing(m);
    setCodigo(m.codigo);
    setCapacidadStr(String(m.capacidad));
    setDescripcion(m.descripcion_publica ?? '');
    setNotas(m.notas ?? '');
    setEstado(m.estado);
    setModalOpen(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const save = async () => {
    const code = codigo.trim();
    if (!code) {
      Alert.alert('Datos incompletos', 'Indica el código de la mesa (ej. M-12).');
      return;
    }
    const cap = Number(capacidadStr);
    if (!Number.isInteger(cap) || cap < 1) {
      Alert.alert('Capacidad', 'La capacidad debe ser un número entero mayor que cero.');
      return;
    }
    setBusy(true);
    const payload = {
      codigo: code,
      capacidad: cap,
      descripcion_publica: descripcion.trim() || null,
      notas: notas.trim() || null,
      estado,
    };
    if (editing) {
      const { error } = await supabase.from('mesas').update(payload).eq('id', editing.id);
      setBusy(false);
      if (error) {
        Alert.alert('No se pudo guardar', mapAdminSupabaseError(error.message, 'mesas'));
        return;
      }
    } else {
      const { error } = await supabase.from('mesas').insert({ ...payload, estado: 'libre' });
      setBusy(false);
      if (error) {
        Alert.alert('No se pudo crear', mapAdminSupabaseError(error.message, 'mesas'));
        return;
      }
    }
    setModalOpen(false);
    await load();
  };

  const confirmDelete = (m: MesaRow) => {
    if (m.estado !== 'libre') {
      Alert.alert(
        'Mesa en uso',
        'Solo puedes eliminar mesas en estado libre. Libera la mesa desde operación si aplica.',
      );
      return;
    }
    Alert.alert('Eliminar mesa', `¿Eliminar ${mesaEtiqueta(m.codigo)}? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('mesas').delete().eq('id', m.id);
          if (error) {
            Alert.alert('No se pudo eliminar', mapAdminSupabaseError(error.message, 'mesas'));
            return;
          }
          await load();
        },
      },
    ]);
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
            placeholder="Buscar por código…"
            placeholderTextColor={AcColors.textMuted}
            style={adminStyles.searchInput}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} style={adminStyles.searchClear}>
              <Ionicons name="close-circle" size={20} color={AcColors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={AcColors.accent} style={adminStyles.loader} />
        ) : filtered.length === 0 ? (
          <View style={adminStyles.emptyCard}>
            <Ionicons name="grid-outline" size={32} color={AcColors.textMuted} />
            <Text style={adminStyles.emptyTitle}>Sin mesas</Text>
            <Text style={adminStyles.emptySub}>Crea la primera mesa con el botón +.</Text>
          </View>
        ) : (
          filtered.map((m) => {
            const st = estadoMesaStyle(m.estado);
            return (
              <View key={m.id} style={[adminStyles.card, adminCardShadow]}>
                <Text style={adminStyles.cardTitle}>{mesaEtiqueta(m.codigo)}</Text>
                <Text style={adminStyles.cardSub}>
                  Capacidad: {m.capacidad} personas
                  {m.descripcion_publica ? ` · ${m.descripcion_publica}` : ''}
                </Text>
                <View style={adminStyles.tagRow}>
                  <View style={[adminStyles.estadoTag, { backgroundColor: st.bg }]}>
                    <Text style={[adminStyles.estadoTagText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <View style={adminStyles.cardActions}>
                  <Pressable style={adminStyles.btnIcon} onPress={() => openEdit(m)}>
                    <Ionicons name="create-outline" size={18} color={AcColors.accent} />
                    <Text style={adminStyles.btnIconText}>Editar</Text>
                  </Pressable>
                  <Pressable
                    style={[adminStyles.btnIcon, adminStyles.btnIconDanger]}
                    onPress={() => confirmDelete(m)}>
                    <Ionicons name="trash-outline" size={18} color={AcColors.danger} />
                    <Text style={[adminStyles.btnIconText, adminStyles.btnIconTextDanger]}>Eliminar</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Pressable style={adminStyles.fab} onPress={openCreate} accessibilityLabel="Nueva mesa">
        <Ionicons name="add" size={28} color={AcColors.onAccent} />
      </Pressable>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => !busy && setModalOpen(false)}>
        <Pressable style={adminStyles.modalBackdrop} onPress={() => !busy && setModalOpen(false)}>
          <View style={adminStyles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={adminStyles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={adminStyles.modalTitle}>{editing ? 'Editar mesa' : 'Nueva mesa'}</Text>
              <Text style={adminStyles.modalLabel}>Código</Text>
              <TextInput
                value={codigo}
                onChangeText={setCodigo}
                placeholder="1"
                placeholderTextColor={AcColors.textMuted}
                style={adminStyles.input}
                autoCapitalize="characters"
              />
              <Text style={adminStyles.modalLabel}>Capacidad (personas)</Text>
              <TextInput
                value={capacidadStr}
                onChangeText={setCapacidadStr}
                keyboardType="number-pad"
                style={adminStyles.input}
              />
              <Text style={adminStyles.modalLabel}>Descripción pública (opcional)</Text>
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Ventana, terraza…"
                placeholderTextColor={AcColors.textMuted}
                style={adminStyles.input}
              />
              <Text style={adminStyles.modalLabel}>Notas internas (opcional)</Text>
              <TextInput
                value={notas}
                onChangeText={setNotas}
                style={[adminStyles.input, adminStyles.inputMultiline]}
                multiline
              />
              {editing ? (
                <>
                  <Text style={adminStyles.modalLabel}>Estado</Text>
                  <View style={adminStyles.chipRow}>
                    {ESTADOS.map((e) => (
                      <Pressable
                        key={e}
                        style={[adminStyles.chip, estado === e && adminStyles.chipOn]}
                        onPress={() => setEstado(e)}>
                        <Text style={[adminStyles.chipText, estado === e && adminStyles.chipTextOn]}>
                          {estadoMesaStyle(e).label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
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
