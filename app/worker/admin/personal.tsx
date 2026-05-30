import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { AuthBoot } from '@/components/auth-boot';

import { Avatar } from '@/components/avatar';
import { adminCardShadow, adminStyles } from '@/constants/worker-admin-styles';
import { FtColors } from '@/constants/fasttable';
import { useAuth } from '@/contexts/auth-context';
import { REALTIME_ADMIN, useSupabaseRealtimeRefresh } from '@/hooks/use-supabase-realtime-refresh';
import { confirmDialog, notify } from '@/lib/confirm';
import { useGerenteGuardNavigation } from '@/hooks/use-gerente-guard-navigation';
import { roleLabel, type WorkerRol } from '@/lib/worker-nav';
import { supabase } from '@/lib/supabase';

type PersonalRow = {
  id: string;
  id_usuario: string;
  nombre_visible: string;
  rol: WorkerRol;
  codigo_empleado: string | null;
  activo: boolean;
  foto_url: string | null;
  correo: string | null;
};

const ROLES: readonly WorkerRol[] = ['anfitrion', 'mesero', 'cocina', 'gerente'] as const;

const rolTagColor: Record<WorkerRol, string> = {
  gerente: FtColors.accent,
  anfitrion: '#38bdf8',
  mesero: '#a78bfa',
  cocina: '#fb923c',
};

export default function AdminPersonalScreen() {
  const guard = useGerenteGuardNavigation();
  const { user } = useAuth();
  const [rows, setRows] = useState<PersonalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalRow | null>(null);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [rol, setRol] = useState<WorkerRol>('mesero');
  const [activo, setActivo] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('gerente_listar_personal');
    if (error) {
      notify('Error', error.message);
      setRows([]);
      return;
    }
    setRows((data as PersonalRow[]) ?? []);
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
        r.nombre_visible.toLowerCase().includes(q) ||
        (r.correo?.toLowerCase().includes(q) ?? false) ||
        roleLabel(r.rol).toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const openCreate = () => {
    setEditing(null);
    setEmail('');
    setNombre('');
    setCodigo('');
    setRol('mesero');
    setActivo(true);
    setModalOpen(true);
  };

  const openEdit = (m: PersonalRow) => {
    setEditing(m);
    setEmail(m.correo ?? '');
    setNombre(m.nombre_visible);
    setCodigo(m.codigo_empleado ?? '');
    setRol(m.rol);
    setActivo(m.activo);
    setModalOpen(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const save = async () => {
    const correo = email.trim();
    const nom = nombre.trim();
    if (!correo) {
      notify('Falta el correo', 'Indica el correo de una cuenta ya registrada en la app.');
      return;
    }
    if (!nom) {
      notify('Falta el nombre', 'Escribe el nombre con el que se mostrará el empleado.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('gerente_vincular_personal', {
        p_email: correo,
        p_nombre: nom,
        p_rol: rol,
        p_codigo: codigo.trim() || null,
      });
      if (error) {
        notify(editing ? 'No se pudo guardar' : 'No se pudo dar de alta', error.message);
        return;
      }
      // Vincular reactiva siempre; aplica el estado deseado si cambió (no para tu propia cuenta).
      if (editing && !activo && editing.id_usuario !== user?.id) {
        const { error: e2 } = await supabase.rpc('gerente_set_activo_personal', {
          p_id: editing.id,
          p_activo: false,
        });
        if (e2) {
          notify('Aviso', e2.message);
        }
      }
      setModalOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onToggleActivo = async (m: PersonalRow) => {
    const { error } = await supabase.rpc('gerente_set_activo_personal', {
      p_id: m.id,
      p_activo: !m.activo,
    });
    if (error) {
      notify('No se pudo actualizar', error.message);
      return;
    }
    await load();
  };

  const confirmDelete = async (m: PersonalRow) => {
    const ok = await confirmDialog(
      'Quitar del personal',
      `¿Quitar a ${m.nombre_visible} del equipo? Su cuenta seguirá existiendo como comensal, pero perderá el acceso de personal.`,
      'Quitar',
    );
    if (!ok) return;
    const { error } = await supabase.rpc('gerente_eliminar_personal', { p_id: m.id });
    if (error) {
      notify('No se pudo quitar', error.message);
      return;
    }
    await load();
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
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={FtColors.accent} />
          <Text style={styles.noteText}>
            Para dar de alta, la persona debe registrarse antes en la app con su correo. Aquí la vinculas al equipo y le
            asignas un rol.
          </Text>
        </View>

        <View style={adminStyles.searchWrap}>
          <Ionicons name="search" size={18} color={FtColors.textMuted} style={adminStyles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por nombre, correo o rol…"
            placeholderTextColor={FtColors.textMuted}
            style={adminStyles.searchInput}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} style={adminStyles.searchClear}>
              <Ionicons name="close-circle" size={20} color={FtColors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={FtColors.accent} style={adminStyles.loader} />
        ) : filtered.length === 0 ? (
          <View style={adminStyles.emptyCard}>
            <Ionicons name="people-outline" size={32} color={FtColors.textMuted} />
            <Text style={adminStyles.emptyTitle}>Sin personal</Text>
            <Text style={adminStyles.emptySub}>Da de alta al primer miembro con el botón +.</Text>
          </View>
        ) : (
          filtered.map((m) => {
            const isSelf = m.id_usuario === user?.id;
            return (
              <View key={m.id} style={[adminStyles.card, adminCardShadow]}>
                <View style={styles.row}>
                  <Avatar uri={m.foto_url} name={m.nombre_visible} size={48} />
                  <View style={styles.rowMeta}>
                    <View style={styles.nameLine}>
                      <Text style={adminStyles.cardTitle}>{m.nombre_visible}</Text>
                      {isSelf ? <Text style={styles.selfBadge}>Tú</Text> : null}
                    </View>
                    {m.correo ? <Text style={adminStyles.cardSub}>{m.correo}</Text> : null}
                    {m.codigo_empleado ? (
                      <Text style={adminStyles.cardSub}>Código: {m.codigo_empleado}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={adminStyles.tagRow}>
                  <View style={[adminStyles.estadoTag, { backgroundColor: `${rolTagColor[m.rol]}22` }]}>
                    <Text style={[adminStyles.estadoTagText, { color: rolTagColor[m.rol] }]}>{roleLabel(m.rol)}</Text>
                  </View>
                  <View
                    style={[
                      adminStyles.estadoTag,
                      { backgroundColor: m.activo ? `${FtColors.success}22` : `${FtColors.danger}22` },
                    ]}>
                    <Text
                      style={[
                        adminStyles.estadoTagText,
                        { color: m.activo ? FtColors.success : FtColors.danger },
                      ]}>
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </Text>
                  </View>
                </View>

                {isSelf ? (
                  <Text style={styles.selfHint}>Gestiona tu propia cuenta desde “Mi perfil”.</Text>
                ) : (
                  <View style={adminStyles.cardActions}>
                    <Pressable style={adminStyles.btnIcon} onPress={() => openEdit(m)}>
                      <Ionicons name="create-outline" size={18} color={FtColors.accent} />
                      <Text style={adminStyles.btnIconText}>Editar</Text>
                    </Pressable>
                    <Pressable style={adminStyles.btnIcon} onPress={() => onToggleActivo(m)}>
                      <Ionicons
                        name={m.activo ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={18}
                        color={FtColors.accent}
                      />
                      <Text style={adminStyles.btnIconText}>{m.activo ? 'Desactivar' : 'Activar'}</Text>
                    </Pressable>
                    <Pressable
                      style={[adminStyles.btnIcon, adminStyles.btnIconDanger]}
                      onPress={() => confirmDelete(m)}>
                      <Ionicons name="trash-outline" size={18} color={FtColors.danger} />
                      <Text style={[adminStyles.btnIconText, adminStyles.btnIconTextDanger]}>Quitar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Pressable style={adminStyles.fab} onPress={openCreate} accessibilityLabel="Dar de alta empleado">
        <Ionicons name="add" size={28} color={FtColors.onAccent} />
      </Pressable>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => !busy && setModalOpen(false)}>
        <Pressable style={adminStyles.modalBackdrop} onPress={() => !busy && setModalOpen(false)}>
          <View style={adminStyles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={adminStyles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={adminStyles.modalTitle}>{editing ? 'Editar empleado' : 'Dar de alta empleado'}</Text>

              <Text style={adminStyles.modalLabel}>Correo de la cuenta</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                editable={!editing}
                placeholder="persona@correo.com"
                placeholderTextColor={FtColors.textMuted}
                style={[adminStyles.input, !!editing && styles.inputDisabled]}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={adminStyles.modalLabel}>Nombre visible</Text>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Nombre del empleado"
                placeholderTextColor={FtColors.textMuted}
                style={adminStyles.input}
              />

              <Text style={adminStyles.modalLabel}>Código de empleado (opcional)</Text>
              <TextInput
                value={codigo}
                onChangeText={setCodigo}
                placeholder="EMP-001"
                placeholderTextColor={FtColors.textMuted}
                style={adminStyles.input}
                autoCapitalize="characters"
              />

              <Text style={adminStyles.modalLabel}>Rol</Text>
              <View style={adminStyles.chipRow}>
                {ROLES.map((r) => (
                  <Pressable
                    key={r}
                    style={[adminStyles.chip, rol === r && adminStyles.chipOn]}
                    onPress={() => setRol(r)}>
                    <Text style={[adminStyles.chipText, rol === r && adminStyles.chipTextOn]}>{roleLabel(r)}</Text>
                  </Pressable>
                ))}
              </View>

              {editing && editing.id_usuario !== user?.id ? (
                <>
                  <Text style={adminStyles.modalLabel}>Estado</Text>
                  <View style={adminStyles.chipRow}>
                    <Pressable
                      style={[adminStyles.chip, activo && adminStyles.chipOn]}
                      onPress={() => setActivo(true)}>
                      <Text style={[adminStyles.chipText, activo && adminStyles.chipTextOn]}>Activo</Text>
                    </Pressable>
                    <Pressable
                      style={[adminStyles.chip, !activo && adminStyles.chipOn]}
                      onPress={() => setActivo(false)}>
                      <Text style={[adminStyles.chipText, !activo && adminStyles.chipTextOn]}>Inactivo</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              <Pressable style={[adminStyles.modalOk, busy && adminStyles.modalOkOff]} onPress={save} disabled={busy}>
                <Text style={adminStyles.modalOkText}>
                  {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Dar de alta'}
                </Text>
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

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FtColors.border,
    backgroundColor: FtColors.surface,
    marginBottom: 12,
  },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: FtColors.textMuted },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rowMeta: { flex: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selfBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: FtColors.accent,
    backgroundColor: `${FtColors.accent}22`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  selfHint: { fontSize: 12.5, color: FtColors.textMuted, marginTop: 10, fontStyle: 'italic' },
  inputDisabled: { opacity: 0.6 },
});
