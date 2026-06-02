import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';

import { Avatar } from '@/components/avatar';
import { useAuth } from '@/contexts/auth-context';
import { AcColors, AcSurfaces } from '@/constants/alacarta';
import {
  canShowNoShow,
  mapReservaRows,
  mapStaffRpcError,
  sortReservasByTime,
  type ReservaStaffRow,
} from '@/lib/worker-reservations-logic';
import { REALTIME_WORKER_RESERVATIONS, useSupabaseRealtimeRefresh } from '@/hooks/use-supabase-realtime-refresh';
import { useNow } from '@/hooks/use-now';
import { confirmDialog } from '@/lib/confirm';
import { mesaEtiqueta } from '@/lib/mesa-label';
import { supabase } from '@/lib/supabase';

type MeseroLoad = { id: string; nombre_visible: string; mesasAtendidas: number };

function fmt(d: string) {
  return new Date(d).toLocaleString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WorkerReservationsScreen() {
  const router = useRouter();
  const { session, staffMember, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reservas, setReservas] = useState<ReservaStaffRow[]>([]);
  const [names, setNames] = useState<Record<string, string | null>>({});
  const [fotos, setFotos] = useState<Record<string, string | null>>({});
  const [meseroLoads, setMeseroLoads] = useState<MeseroLoad[]>([]);
  const [selectedMeseroByReserva, setSelectedMeseroByReserva] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    await supabase.rpc('expirar_reservas_vencidas');
    const [{ data: resData }, { data: meserosData }, { data: mesasConMesero }] = await Promise.all([
      supabase
        .from('reservas_mesa')
        .select(
          'id, id_usuario, fecha_hora_reserva, mesero_atender_a_partir_de, personas_grupo, nota, comensal_llego, ciclo, mesas ( id, codigo, estado, id_personal_atendiendo )',
        )
        .eq('ciclo', 'activa')
        .is('comensal_llego', null)
        .order('fecha_hora_reserva'),
      supabase
        .from('personal')
        .select('id, nombre_visible')
        .eq('activo', true)
        .eq('rol', 'mesero')
        .order('nombre_visible'),
      supabase.from('mesas').select('id_personal_atendiendo').not('id_personal_atendiendo', 'is', null),
    ]);

    const rows = mapReservaRows((resData ?? []) as Record<string, unknown>[]);
    setReservas(rows);

    const assignedCounts = new Map<string, number>();
    for (const row of (mesasConMesero ?? []) as { id_personal_atendiendo: string | null }[]) {
      if (!row.id_personal_atendiendo) continue;
      assignedCounts.set(row.id_personal_atendiendo, (assignedCounts.get(row.id_personal_atendiendo) ?? 0) + 1);
    }
    setMeseroLoads(
      ((meserosData ?? []) as { id: string; nombre_visible: string }[]).map((mesero) => ({
        id: mesero.id,
        nombre_visible: mesero.nombre_visible,
        mesasAtendidas: assignedCounts.get(mesero.id) ?? 0,
      })),
    );

    const userIds = [...new Set(rows.map((r) => r.id_usuario))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, foto_url')
        .in('id', userIds);
      const m: Record<string, string | null> = {};
      const f: Record<string, string | null> = {};
      for (const p of profs ?? []) {
        m[p.id] = p.nombre_completo;
        f[p.id] = p.foto_url;
      }
      setNames(m);
      setFotos(f);
    } else {
      setNames({});
      setFotos({});
    }
  }, []);

  const pendingReservasOrdered = useMemo(() => sortReservasByTime(reservas), [reservas]);
  const now = useNow();

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
    REALTIME_WORKER_RESERVATIONS,
    load,
    !!session && !!staffMember && (staffMember.rol === 'anfitrion' || staffMember.rol === 'gerente'),
  );

  const resolve = async (id: string, arrived: boolean) => {
    const { error } = await supabase.rpc('personal_resolver_reserva', {
      p_id_reserva: id,
      p_comensal_llego: arrived,
    });
    if (error) {
      Alert.alert('Atención', mapStaffRpcError(error.message));
      return;
    }
    await load();
  };

  const marcarComensalNoLlego = async (id: string) => {
    const ok = await confirmDialog(
      'Comensal no llegó',
      '¿Marcar que el comensal no se presentó? Se liberará la mesa si no hay otra reserva vigente.',
      'No llegó',
    );
    if (!ok) return;
    await resolve(id, false);
  };

  const onAtenderCompleta = async (id: string) => {
    const meseroId = selectedMeseroByReserva[id];
    if (!meseroId) {
      Alert.alert('Atender', 'Selecciona el mesero responsable antes de atender la reserva.');
      return;
    }
    const { error } = await supabase.rpc('personal_atender_reserva_completa_asignando_mesero', {
      p_id_reserva: id,
      p_id_mesero: meseroId,
    });
    if (error) {
      Alert.alert('Atender', mapStaffRpcError(error.message));
      return;
    }
    setSelectedMeseroByReserva((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await load();
  };

  if (authLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={AcColors.accent} />
      </View>
    );
  }

  if (!session || !staffMember) {
    return <Redirect href="/login" />;
  }

  if (staffMember.rol === 'mesero') {
    return <Redirect href="/worker" />;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={AcColors.accent}
          colors={[AcColors.accent]}
        />
      }>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Volver al panel</Text>
      </Pressable>

      {loading && !refreshing ? <ActivityIndicator color={AcColors.accent} style={styles.loader} /> : null}

      <Text style={styles.h1}>Reservas pendientes</Text>
      <Text style={styles.sub}>
        La mesa ya viene de la reserva del comensal. Elige mesero y pulsa “Atender” cuando llegue. Tras 5 min de la
        hora acordada podrás marcar “Comensal no llegó”.
      </Text>

      {pendingReservasOrdered.length === 0 ? (
        <Text style={styles.empty}>No hay reservas activas.</Text>
      ) : (
        pendingReservasOrdered.map((r) => {
          const t = r.mesas;
          const code = t?.codigo;
          const guest = names[r.id_usuario]?.trim() || 'Cliente';
          const other = t?.id_personal_atendiendo != null && t.id_personal_atendiendo !== staffMember.id;
          const showNoShow = canShowNoShow(r, now);
          const isLate = new Date(r.fecha_hora_reserva).getTime() < now.getTime();

          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.guestRow}>
                <Avatar uri={fotos[r.id_usuario]} name={guest} size={42} />
                <Text style={[styles.cardTitle, { flex: 1, marginBottom: 0 }]}>
                  {mesaEtiqueta(code)} · {guest}
                </Text>
              </View>
              <Text style={[styles.badge, isLate ? styles.badgeWarn : styles.badgeInfo]}>
                {isLate ? 'Prioridad alta' : 'Programada'}
              </Text>
              <Text style={styles.line}>Hora acordada: {fmt(r.fecha_hora_reserva)}</Text>
              <Text style={styles.line}>Personas: {r.personas_grupo}</Text>
              {r.nota ? <Text style={styles.line}>Nota: {r.nota}</Text> : null}
              {other ? (
                <Text style={styles.warn}>Otro mesero está atendiendo esta mesa.</Text>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Mesero responsable</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.choiceRow}>
                    {meseroLoads.length === 0 ? (
                      <Text style={styles.empty}>Sin meseros en línea.</Text>
                    ) : (
                      meseroLoads.map((m) => (
                        <Pressable
                          key={m.id}
                          style={[
                            styles.choiceChip,
                            selectedMeseroByReserva[r.id] === m.id && styles.choiceChipActive,
                          ]}
                          onPress={() => setSelectedMeseroByReserva((p) => ({ ...p, [r.id]: m.id }))}>
                          <Text
                            style={[
                              styles.choiceChipText,
                              selectedMeseroByReserva[r.id] === m.id && styles.choiceChipTextActive,
                            ]}>
                            {m.nombre_visible} ({m.mesasAtendidas})
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </ScrollView>
                  <View style={styles.quickActions}>
                    <Pressable style={styles.btnOk} onPress={() => onAtenderCompleta(r.id)}>
                      <Text style={styles.btnOkText}>Atender</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btnNo, !showNoShow && styles.btnNoDisabled]}
                      onPress={() => void marcarComensalNoLlego(r.id)}
                      disabled={!showNoShow}>
                      <Text style={styles.btnNoText}>Comensal no llegó</Text>
                    </Pressable>
                  </View>
                  {!showNoShow ? (
                    <Text style={styles.hintSmall}>
                      Tras 5 min desde la hora acordada podrás marcar “Comensal no llegó”.
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: AcColors.background },
  scroll: { flex: 1, backgroundColor: AcColors.background },
  content: { padding: 18, paddingBottom: 44 },
  back: { marginBottom: 12 },
  backText: { fontSize: 15, color: AcColors.accentText },
  loader: { marginBottom: 16 },
  h1: { fontSize: 19, fontWeight: '800', color: AcColors.text, marginBottom: 6 },
  sub: { fontSize: 13, color: AcColors.textMuted, lineHeight: 20, marginBottom: 12 },
  empty: { fontSize: 14, color: AcColors.textMuted, marginBottom: 12 },
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: AcColors.surfaceElevated,
    borderWidth: 1,
    borderColor: AcColors.border,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: AcColors.text, marginBottom: 8 },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  badgeInfo: { color: AcColors.accentText, backgroundColor: AcSurfaces.accentChip },
  badgeWarn: { color: AcColors.warning, backgroundColor: AcSurfaces.warningBanner },
  line: { fontSize: 14, color: AcColors.textMuted, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: AcColors.textMuted, marginTop: 8, marginBottom: 8 },
  choiceRow: { marginBottom: 4 },
  choiceChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AcColors.border,
    backgroundColor: AcColors.surface,
    marginRight: 8,
  },
  choiceChipActive: { borderColor: AcColors.accent, backgroundColor: AcSurfaces.accentChip },
  choiceChipText: { fontSize: 13, fontWeight: '700', color: AcColors.textMuted },
  choiceChipTextActive: { color: AcColors.text },
  warn: { fontSize: 13, color: AcColors.warning, marginTop: 8 },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnOk: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: AcColors.success,
    alignItems: 'center',
  },
  btnOkText: { color: AcColors.onAccent, fontWeight: '800', fontSize: 14 },
  btnNo: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: AcColors.surface,
    borderWidth: 1,
    borderColor: AcColors.border,
    alignItems: 'center',
  },
  btnNoDisabled: { opacity: 0.45 },
  btnNoText: { color: AcColors.text, fontWeight: '700', fontSize: 14 },
  hintSmall: { fontSize: 11, color: AcColors.textMuted, marginTop: 10, lineHeight: 16 },
});
