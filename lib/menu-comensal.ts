/** Campos de carta visibles para comensales (sin datos de almacén). */
export type ItemMenuComensal = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_centavos: number;
  disponible: boolean;
  /** Solo uso interno al cargar; no mostrar en UI. */
  sin_stock?: boolean;
  imagen_url: string | null;
};

/** Si el comensal no puede pedir este plato (disponibilidad operativa, sin mostrar stock). */
export function itemNoPedible(item: Pick<ItemMenuComensal, 'disponible' | 'sin_stock'>): boolean {
  return !item.disponible || !!item.sin_stock;
}

/** Etiqueta única de disponibilidad para la carta (sin mencionar inventario). */
export function etiquetaDisponibilidadComensal(
  item: Pick<ItemMenuComensal, 'disponible' | 'sin_stock'>,
): string | null {
  return itemNoPedible(item) ? 'No disponible' : null;
}
