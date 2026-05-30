import { useCallback, useEffect, useState } from 'react';

import { navForRole, type WorkerNavItem, type WorkerRol } from '@/lib/worker-nav';
import { supabase } from '@/lib/supabase';

/**
 * Contadores para la barra lateral web del personal (por rol).
 * Se actualiza al cambiar de ruta y vía Realtime.
 */
export function useWorkerNavBadges(
  rol: WorkerRol | string | undefined,
  staffId: string | null,
  pathname?: string,
) {
  const [badges, setBadges] = useState<Record<string, number>>({});

  const loadBadges = useCallback(async () => {
    if (!rol) {
      setBadges({});
      return;
    }
    const items = navForRole(rol);
    const keys = new Set(items.map((i) => i.badgeKey).filter((k): k is string => !!k));
    if (keys.size === 0) {
      setBadges({});
      return;
    }

    const next: Record<string, number> = {};

    const tasks: Promise<void>[] = [];

    if (keys.has('solicitudes')) {
      tasks.push(
        (async () => {
          const { count } = await supabase
            .from('solicitudes_servicio')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'abierta');
          next.solicitudes = count ?? 0;
        })(),
      );
    }

    if (keys.has('mesas_libres')) {
      tasks.push(
        (async () => {
          const { count } = await supabase
            .from('mesas')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'libre');
          next.mesas_libres = count ?? 0;
        })(),
      );
    }

    if (keys.has('fila')) {
      tasks.push(
        (async () => {
          const { count } = await supabase
            .from('fila_espera')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'esperando');
          next.fila = count ?? 0;
        })(),
      );
    }

    if (keys.has('reservas')) {
      tasks.push(
        (async () => {
          const { count } = await supabase
            .from('reservas_mesa')
            .select('*', { count: 'exact', head: true })
            .eq('ciclo', 'activa');
          next.reservas = count ?? 0;
        })(),
      );
    }

    if (keys.has('reservas_atender')) {
      tasks.push(
        (async () => {
          await supabase.rpc('expirar_reservas_vencidas');
          const { count } = await supabase
            .from('reservas_mesa')
            .select('*', { count: 'exact', head: true })
            .eq('ciclo', 'activa')
            .is('comensal_llego', null);
          next.reservas_atender = count ?? 0;
        })(),
      );
    }

    if (keys.has('reportes')) {
      tasks.push(
        (async () => {
          const { count } = await supabase
            .from('reportes_problema')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'abierto');
          next.reportes = count ?? 0;
        })(),
      );
    }

    if (keys.has('pedidos')) {
      tasks.push(
        (async () => {
          const { count } = await supabase
            .from('pedidos_cocina')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'pendiente');
          next.pedidos = count ?? 0;
        })(),
      );
    }

    if (keys.has('no_disponibles')) {
      tasks.push(
        (async () => {
          const { count } = await supabase
            .from('items_menu')
            .select('*', { count: 'exact', head: true })
            .eq('disponible', false);
          next.no_disponibles = count ?? 0;
        })(),
      );
    }

    if (keys.has('mis_mesas') && staffId) {
      tasks.push(
        (async () => {
          const { count } = await supabase
            .from('mesas')
            .select('*', { count: 'exact', head: true })
            .eq('id_personal_atendiendo', staffId)
            .in('estado', ['ocupada', 'reservada']);
          next.mis_mesas = count ?? 0;
        })(),
      );
    }

    await Promise.all(tasks);
    setBadges(next);
  }, [rol, staffId]);

  useEffect(() => {
    void loadBadges();
  }, [loadBadges, pathname]);

  useEffect(() => {
    if (!rol) return;
    const tables = [
      'solicitudes_servicio',
      'mesas',
      'fila_espera',
      'reservas_mesa',
      'reportes_problema',
      'pedidos_cocina',
      'items_menu',
      'servicios_mesa',
    ];
    const channel = supabase.channel(`rt:nav-badges:${rol}:${Date.now()}`);
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => void loadBadges());
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [rol, loadBadges]);

  return { badges, reloadBadges: loadBadges };
}

export function badgeCountForItem(item: WorkerNavItem, badges: Record<string, number>): number {
  if (!item.badgeKey) return 0;
  return badges[item.badgeKey] ?? 0;
}
