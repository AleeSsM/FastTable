import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { REALTIME_WORKER_DASHBOARD, useSupabaseRealtimeRefresh } from '@/hooks/use-supabase-realtime-refresh';
import { confirmDialog, notify } from '@/lib/confirm';
import { fetchCuentaMesaServicio } from '@/lib/cuenta-mesa';
import { formatPriceFromCents } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  canShowNoShow,
  mapReservaRows,
  mapStaffRpcError,
  splitReservationsByTime,
  type ReservaStaffRow,
} from '@/lib/worker-reservations-logic';

export type SolicitudRow = {
  id: string;
  mensaje: string | null;
  creado_en: string;
  mesas: { codigo: string } | { codigo: string }[] | null;
};
export type MesaAsignada = { id: string; codigo: string; estado: 'libre' | 'ocupada' | 'reservada' };
export type MesaToggle = {
  id: string;
  codigo: string;
  estado: 'libre' | 'ocupada' | 'reservada';
  id_personal_atendiendo: string | null;
};
export type WaitlistEntry = {
  id: string;
  id_usuario: string | null;
  nombre_cliente: string | null;
  personas_grupo: number;
  nota: string | null;
  unido_en: string;
  id_mesa_asignada: string | null;
};
export type MeseroOption = { id: string; nombre_visible: string };
export type MeseroLoad = { id: string; nombre_visible: string; mesasAtendidas: number };
export type MesaClienteInfo = { userId: string | null; nombre: string | null; foto: string | null };
export type { ReservaStaffRow };

export function fmtFecha(d: string): string {
  return new Date(d).toLocaleString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function solicitudCodigo(m: SolicitudRow['mesas']): string {
  if (m == null) return '—';
  const z = Array.isArray(m) ? m[0] : m;
  return z?.codigo ?? '—';
}

export function formatGuestName(
  name: string | null | undefined,
  userId: string | null,
  queueName: string | null | undefined,
): string {
  const queueClean = queueName?.trim();
  if (queueClean) return queueClean;
  const cleaned = name?.trim();
  if (cleaned) return cleaned;
  if (userId) return `Usuario ${userId.slice(0, 8)}`;
  return 'Sin nombre';
}

/**
 * Toda la lógica operativa del panel de anfitrión/mesero (datos + acciones).
 * La consumen tanto la pantalla móvil (`index.tsx`) como la de escritorio
 * (`index.web.tsx`), así la UI cambia sin duplicar la lógica.
 */
export function useWorkerDashboard() {
  const { session, staffMember } = useAuth();

  const [available, setAvailable] = useState<number | null>(null);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [openReqCount, setOpenReqCount] = useState<number | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudRow[]>([]);
  const [allMesas, setAllMesas] = useState<MesaToggle[]>([]);
  const [reservas, setReservas] = useState<ReservaStaffRow[]>([]);
  const [names, setNames] = useState<Record<string, string | null>>({});
  const [fotos, setFotos] = useState<Record<string, string | null>>({});
  const [myMesas, setMyMesas] = useState<MesaAsignada[]>([]);
  const [mesaClientes, setMesaClientes] = useState<Record<string, MesaClienteInfo>>({});
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [waitlistNames, setWaitlistNames] = useState<Record<string, string | null>>({});
  const [waitlistFotos, setWaitlistFotos] = useState<Record<string, string | null>>({});
  const [meseros, setMeseros] = useState<MeseroOption[]>([]);
  const [meseroLoads, setMeseroLoads] = useState<MeseroLoad[]>([]);
  const [selectedMesaByEntry, setSelectedMesaByEntry] = useState<Record<string, string>>({});
  const [selectedMeseroByEntry, setSelectedMeseroByEntry] = useState<Record<string, string>>({});
  const [selectedMeseroByReserva, setSelectedMeseroByReserva] = useState<Record<string, string>>({});
  const [assigningEntryId, setAssigningEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mesaBusy, setMesaBusy] = useState<string | null>(null);
  const [terminarBusyId, setTerminarBusyId] = useState<string | null>(null);

  const isHost = staffMember?.rol === 'anfitrion' || staffMember?.rol === 'gerente';
  const isWaiter = staffMember?.rol === 'mesero';

  const load = useCallback(async () => {
    if (!staffMember?.id) return;
    await supabase.rpc('expirar_reservas_vencidas');
    const [tAvail, tWait, tSol, resData, mine, todas, filaData, meserosData, mesasConMesero] = await Promise.all([
      supabase.from('mesas').select('*', { count: 'exact', head: true }).eq('estado', 'libre'),
      supabase.from('fila_espera').select('*', { count: 'exact', head: true }).eq('estado', 'esperando'),
      supabase
        .from('solicitudes_servicio')
        .select('id, mensaje, creado_en, mesas ( codigo )')
        .eq('estado', 'abierta')
        .order('creado_en', { ascending: true }),
      supabase
        .from('reservas_mesa')
        .select(
          'id, id_usuario, fecha_hora_reserva, mesero_atender_a_partir_de, personas_grupo, nota, comensal_llego, ciclo, mesas ( id, codigo, estado, id_personal_atendiendo )',
        )
        .eq('ciclo', 'activa')
        .is('comensal_llego', null)
        .order('fecha_hora_reserva'),
      supabase
        .from('mesas')
        .select('id, codigo, estado')
        .eq('id_personal_atendiendo', staffMember.id)
        .in('estado', ['ocupada', 'reservada'])
        .order('codigo'),
      supabase.from('mesas').select('id, codigo, estado, id_personal_atendiendo').order('codigo'),
      supabase
        .from('fila_espera')
        .select('id, id_usuario, nombre_cliente, personas_grupo, nota, unido_en, id_mesa_asignada')
        .eq('estado', 'esperando')
        .order('unido_en', { ascending: true }),
      supabase
        .from('personal')
        .select('id, nombre_visible')
        .eq('activo', true)
        .eq('rol', 'mesero')
        .order('nombre_visible'),
      supabase.from('mesas').select('id_personal_atendiendo').not('id_personal_atendiendo', 'is', null),
    ]);

    setAvailable(tAvail.count ?? 0);
    setWaiting(tWait.count ?? 0);
    setOpenReqCount(tSol.data?.length ?? 0);
    setSolicitudes((tSol.data as SolicitudRow[]) ?? []);
    setAllMesas((todas.data as MesaToggle[]) ?? []);

    if (filaData.error) {
      setWaitlist([]);
      notify('Fila', filaData.error.message);
    } else {
      const fila = (filaData.data as WaitlistEntry[]) ?? [];
      setWaitlist(fila);
      const waitUserIds = [...new Set(fila.map((f) => f.id_usuario).filter((id): id is string => !!id))];
      if (waitUserIds.length > 0) {
        const { data: waitProfs } = await supabase
          .from('perfiles')
          .select('id, nombre_completo, foto_url')
          .in('id', waitUserIds);
        const wm: Record<string, string | null> = {};
        const wf: Record<string, string | null> = {};
        for (const p of waitProfs ?? []) {
          wm[p.id] = p.nombre_completo;
          wf[p.id] = p.foto_url;
        }
        setWaitlistNames(wm);
        setWaitlistFotos(wf);
      } else {
        setWaitlistNames({});
        setWaitlistFotos({});
      }
    }

    const meserosList = (meserosData.data as MeseroOption[]) ?? [];
    setMeseros(meserosList);
    const assignedCounts = new Map<string, number>();
    for (const row of (mesasConMesero.data ?? []) as { id_personal_atendiendo: string | null }[]) {
      if (!row.id_personal_atendiendo) continue;
      assignedCounts.set(row.id_personal_atendiendo, (assignedCounts.get(row.id_personal_atendiendo) ?? 0) + 1);
    }
    setMeseroLoads(
      meserosList.map((mesero) => ({
        id: mesero.id,
        nombre_visible: mesero.nombre_visible,
        mesasAtendidas: assignedCounts.get(mesero.id) ?? 0,
      })),
    );

    const rows = mapReservaRows((resData.data ?? []) as Record<string, unknown>[]);
    setReservas(rows);
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

    const mineRows = (mine.data as MesaAsignada[]) ?? [];
    setMyMesas(mineRows);

    // Cliente que ocupa cada una de mis mesas (para que el mesero vea nombre + foto).
    const myMesaIds = mineRows.map((m) => m.id);
    if (myMesaIds.length > 0) {
      const { data: servAct } = await supabase
        .from('servicios_mesa')
        .select('id_mesa, id_usuario, nombre_invitado')
        .eq('estado', 'activo')
        .in('id_mesa', myMesaIds);
      const serv = (servAct ?? []) as {
        id_mesa: string;
        id_usuario: string | null;
        nombre_invitado: string | null;
      }[];
      const clientIds = [...new Set(serv.map((s) => s.id_usuario).filter((id): id is string => !!id))];
      const profMap: Record<string, { nombre: string | null; foto: string | null }> = {};
      if (clientIds.length > 0) {
        const { data: cps } = await supabase
          .from('perfiles')
          .select('id, nombre_completo, foto_url')
          .in('id', clientIds);
        for (const p of cps ?? []) profMap[p.id] = { nombre: p.nombre_completo, foto: p.foto_url };
      }
      const mc: Record<string, MesaClienteInfo> = {};
      for (const s of serv) {
        const pr = s.id_usuario ? profMap[s.id_usuario] : undefined;
        mc[s.id_mesa] = {
          userId: s.id_usuario,
          nombre: pr?.nombre ?? s.nombre_invitado ?? null,
          foto: pr?.foto ?? null,
        };
      }
      setMesaClientes(mc);
    } else {
      setMesaClientes({});
    }
  }, [staffMember?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!session || !staffMember) return;
      let active = true;
      setLoading(true);
      load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [session, staffMember, load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useSupabaseRealtimeRefresh(
    REALTIME_WORKER_DASHBOARD,
    load,
    !!session &&
      !!staffMember &&
      (staffMember.rol === 'mesero' || staffMember.rol === 'anfitrion' || staffMember.rol === 'gerente'),
  );

  const { upcoming, attend } = useMemo(() => splitReservationsByTime(reservas, new Date()), [reservas]);
  const attendOrdered = useMemo(
    () =>
      [...attend].sort(
        (a, b) => new Date(a.fecha_hora_reserva).getTime() - new Date(b.fecha_hora_reserva).getTime(),
      ),
    [attend],
  );

  const onDeleteSolicitud = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('solicitudes_servicio').delete().eq('id', id);
      if (error) {
        notify('Solicitud', error.message);
        return;
      }
      await load();
    },
    [load],
  );

  const marcarSolicitudAtendida = useCallback(
    async (id: string) => {
      const ok = await confirmDialog('Marcar atendida', '¿Eliminar esta solicitud?', 'Atendida');
      if (ok) await onDeleteSolicitud(id);
    },
    [onDeleteSolicitud],
  );

  const resolve = useCallback(
    async (id: string, arrived: boolean) => {
      const { error } = await supabase.rpc('personal_resolver_reserva', {
        p_id_reserva: id,
        p_comensal_llego: arrived,
      });
      if (error) {
        notify('Reserva', mapStaffRpcError(error.message));
        return;
      }
      await load();
    },
    [load],
  );

  const onAtenderCompleta = useCallback(
    async (id: string) => {
      const meseroId = selectedMeseroByReserva[id];
      if (isHost && !meseroId) {
        notify('Atender', 'Selecciona el mesero responsable antes de atender la reserva.');
        return;
      }
      const { error } = await supabase.rpc(
        isHost ? 'personal_atender_reserva_completa_asignando_mesero' : 'personal_atender_reserva_completa',
        isHost ? { p_id_reserva: id, p_id_mesero: meseroId } : { p_id_reserva: id },
      );
      if (error) {
        notify('Atender', mapStaffRpcError(error.message));
        return;
      }
      setSelectedMeseroByReserva((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    },
    [isHost, selectedMeseroByReserva, load],
  );

  const ejecutarTerminarServicio = useCallback(
    async (mesaId: string) => {
      setTerminarBusyId(mesaId);
      try {
        const { error } = await supabase.rpc('personal_liberar_mesa_atendida', { p_id_mesa: mesaId });
        if (error) {
          notify('Mesa', mapStaffRpcError(error.message));
          return;
        }
        await load();
      } finally {
        setTerminarBusyId(null);
      }
    },
    [load],
  );

  const confirmarTerminarServicio = useCallback(
    async (mesa: MesaAsignada) => {
      const cuenta = await fetchCuentaMesaServicio(mesa.id);
      const totalLine =
        cuenta.total_centavos > 0 ? `\n\nTotal del servicio: ${formatPriceFromCents(cuenta.total_centavos)}` : '';
      const ok = await confirmDialog(
        'Terminar servicio',
        `¿Seguro que deseas terminar el servicio de la mesa ${mesa.codigo}?${totalLine}`,
      );
      if (ok) await ejecutarTerminarServicio(mesa.id);
    },
    [ejecutarTerminarServicio],
  );

  const onToggleMesaWalkIn = useCallback(
    async (m: MesaToggle) => {
      if (m.estado === 'reservada') return;
      setMesaBusy(m.id);
      try {
        const { error } = await supabase.rpc('personal_marcar_mesa_libre_ocupada', {
          p_id_mesa: m.id,
          p_ocupar: m.estado === 'libre',
        });
        if (error) notify('Mesa', mapStaffRpcError(error.message));
        else await load();
      } finally {
        setMesaBusy(null);
      }
    },
    [load],
  );

  const onAssignWaitlist = useCallback(
    async (entry: WaitlistEntry) => {
      const mesaId = selectedMesaByEntry[entry.id];
      const meseroId = selectedMeseroByEntry[entry.id];
      if (!mesaId || !meseroId) {
        notify('Fila', 'Selecciona una mesa disponible y un mesero antes de asignar.');
        return;
      }
      setAssigningEntryId(entry.id);
      try {
        const { error } = await supabase.rpc('personal_sentar_desde_fila', {
          p_id_fila: entry.id,
          p_id_mesa: mesaId,
          p_id_mesero: meseroId,
        });
        if (error) {
          const missingRpc =
            error.message.includes('Could not find the function public.personal_sentar_desde_fila') ||
            error.message.includes('PGRST202');
          if (!missingRpc) {
            notify('Asignación', mapStaffRpcError(error.message));
            return;
          }
          const { data: mesaUpdated, error: mesaError } = await supabase
            .from('mesas')
            .update({ estado: 'ocupada', id_personal_atendiendo: meseroId })
            .eq('id', mesaId)
            .eq('estado', 'libre')
            .select('id')
            .maybeSingle();
          if (mesaError) {
            notify('Asignación', mapStaffRpcError(mesaError.message));
            return;
          }
          if (!mesaUpdated) {
            notify('Asignación', 'La mesa ya no está libre, intenta con otra.');
            return;
          }
          const { data: filaUpdated, error: filaError } = await supabase
            .from('fila_espera')
            .update({ estado: 'sentado', sentado_en: new Date().toISOString(), id_mesa_asignada: mesaId })
            .eq('id', entry.id)
            .eq('estado', 'esperando')
            .select('id')
            .maybeSingle();
          if (filaError) {
            notify('Asignación', mapStaffRpcError(filaError.message));
            return;
          }
          if (!filaUpdated) {
            notify('Asignación', 'Ese comensal ya no está en espera.');
            return;
          }
        }
        setSelectedMesaByEntry((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          return next;
        });
        setSelectedMeseroByEntry((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          return next;
        });
        await load();
      } finally {
        setAssigningEntryId(null);
      }
    },
    [selectedMesaByEntry, selectedMeseroByEntry, load],
  );

  // Mesas agrupadas por mesero (solo activas), para el panel de reasignación.
  const meseroMesas = useMemo(() => {
    const map: Record<string, MesaToggle[]> = {};
    for (const m of allMesas) {
      if (m.id_personal_atendiendo && (m.estado === 'ocupada' || m.estado === 'reservada')) {
        (map[m.id_personal_atendiendo] ??= []).push(m);
      }
    }
    return map;
  }, [allMesas]);

  const reasignarMesa = useCallback(
    async (idMesa: string, idMesero: string) => {
      const { error } = await supabase.rpc('personal_reasignar_mesa', {
        p_id_mesa: idMesa,
        p_id_mesero: idMesero,
      });
      if (error) {
        notify('Reasignar', mapStaffRpcError(error.message));
        return;
      }
      await load();
    },
    [load],
  );

  const reasignarMeseroTodo = useCallback(
    async (origenId: string, origenNombre: string, destinoId: string, destinoNombre: string) => {
      const ok = await confirmDialog(
        'Reasignar mesas',
        `¿Pasar todas las mesas de ${origenNombre} a ${destinoNombre}?`,
      );
      if (!ok) return;
      const { error } = await supabase.rpc('personal_reasignar_mesero', {
        p_origen: origenId,
        p_destino: destinoId,
      });
      if (error) {
        notify('Reasignar', mapStaffRpcError(error.message));
        return;
      }
      await load();
    },
    [load],
  );

  return {
    session,
    staffMember,
    isHost,
    isWaiter,
    // datos
    available,
    waiting,
    openReqCount,
    solicitudes,
    allMesas,
    myMesas,
    mesaClientes,
    waitlist,
    waitlistNames,
    waitlistFotos,
    meseros,
    meseroLoads,
    names,
    fotos,
    upcoming,
    attendOrdered,
    // selección
    selectedMesaByEntry,
    setSelectedMesaByEntry,
    selectedMeseroByEntry,
    setSelectedMeseroByEntry,
    selectedMeseroByReserva,
    setSelectedMeseroByReserva,
    // estado de carga
    loading,
    refreshing,
    mesaBusy,
    terminarBusyId,
    assigningEntryId,
    // utilidades
    canShowNoShow,
    // acciones
    load,
    onRefresh,
    onDeleteSolicitud,
    marcarSolicitudAtendida,
    resolve,
    onAtenderCompleta,
    confirmarTerminarServicio,
    onToggleMesaWalkIn,
    onAssignWaitlist,
    meseroMesas,
    reasignarMesa,
    reasignarMeseroTodo,
  };
}
