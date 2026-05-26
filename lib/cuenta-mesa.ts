import { supabase } from '@/lib/supabase';

export type LineaCuentaMesa = {
  id: string;
  cantidad: number;
  nombre: string;
  precio_unit_centavos: number;
  subtotal_centavos: number;
  registrado_por_mesero: boolean;
};

export type CuentaMesaServicio = {
  servicio_id: string | null;
  estado: string | null;
  total_centavos: number;
  lines: LineaCuentaMesa[];
};

type RpcLinea = {
  id: string;
  cantidad: number;
  nombre: string;
  precio_unit_centavos: number;
  subtotal_centavos: number;
  registrado_por_mesero?: boolean;
};

/** Cuenta del servicio activo en la mesa (comensal o personal con acceso). */
export async function fetchCuentaMesaServicio(idMesa: string): Promise<CuentaMesaServicio> {
  const { data, error } = await supabase.rpc('mesa_cuenta_servicio_activo', { p_id_mesa: idMesa });
  if (error || data == null || typeof data !== 'object') {
    return { servicio_id: null, estado: null, total_centavos: 0, lines: [] };
  }
  const raw = data as {
    servicio_id?: string | null;
    estado?: string | null;
    total_centavos?: number;
    lineas?: RpcLinea[];
  };
  const lineas = Array.isArray(raw.lineas) ? raw.lineas : [];
  return {
    servicio_id: raw.servicio_id ?? null,
    estado: raw.estado ?? null,
    total_centavos: raw.total_centavos ?? 0,
    lines: lineas.map((ln) => ({
      id: ln.id,
      cantidad: ln.cantidad,
      nombre: ln.nombre,
      precio_unit_centavos: ln.precio_unit_centavos,
      subtotal_centavos: ln.subtotal_centavos,
      registrado_por_mesero: !!ln.registrado_por_mesero,
    })),
  };
}

export function mapMesaPedidoRpcError(message: string): string {
  if (message.includes('mesa_no_ocupada_pedido') || message.includes('mesa_no_ocupada_servicio')) {
    return 'La mesa debe estar ocupada para registrar pedidos.';
  }
  if (message.includes('mesa_no_encontrada')) return 'Mesa no encontrada.';
  if (message.includes('sin_acceso_cuenta_mesa')) return 'No tienes acceso a la cuenta de esta mesa.';
  if (message.includes('no_tu_mesa')) return 'Esta mesa no está asignada a ti.';
  if (message.includes('solo_personal')) return 'Sin permiso de personal.';
  return message;
}
