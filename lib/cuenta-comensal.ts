import { fetchCuentaMesaServicio, type LineaCuentaMesa } from '@/lib/cuenta-mesa';

export type LineaCuenta = LineaCuentaMesa;

/** Cuenta del servicio activo en la mesa (incluye pedidos del comensal y del mesero). */
export async function fetchLineasCuentaComensal(
  _userId: string,
  idMesa: string,
  _ctx: { id_reserva_mesa: string | null; id_fila_espera: string | null },
): Promise<{
  lines: LineaCuenta[];
  total_centavos: number;
}> {
  const cuenta = await fetchCuentaMesaServicio(idMesa);
  return {
    lines: cuenta.lines.map((ln) => ({
      id: ln.id,
      cantidad: ln.cantidad,
      nombre: ln.nombre,
      precio_unit_centavos: ln.precio_unit_centavos,
      subtotal_centavos: ln.subtotal_centavos,
    })),
    total_centavos: cuenta.total_centavos,
  };
}
