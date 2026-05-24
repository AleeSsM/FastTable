/** Formato simple en MXN (ajusta si multi-moneda). */
export function formatPriceFromCents(cents: number): string {
  const n = cents / 100;
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

// ——— Inventario (unidades de almacén) ———

export type UnidadMedidaInventario = 'g' | 'ml' | 'piezas' | 'unidades';

const UNIDADES_DISCRETAS: readonly UnidadMedidaInventario[] = ['piezas', 'unidades'];

export function normalizeUnidadMedida(raw: string): UnidadMedidaInventario {
  const u = raw.trim().toLowerCase();
  if (u === 'g' || u === 'gramo' || u === 'gramos' || u === 'gr') return 'g';
  if (u === 'ml' || u === 'mililitro' || u === 'mililitros') return 'ml';
  if (u === 'pieza' || u === 'piezas' || u === 'pza' || u === 'pzas') return 'piezas';
  if (u === 'unidad' || u === 'unidades') return 'unidades';
  return 'g';
}

export function esUnidadDiscreta(unidadRaw: string): boolean {
  return UNIDADES_DISCRETAS.includes(normalizeUnidadMedida(unidadRaw));
}

export function etiquetaUnidad(unidadRaw: string, opts?: { plural?: boolean }): string {
  const plural = opts?.plural !== false;
  const u = normalizeUnidadMedida(unidadRaw);
  switch (u) {
    case 'g':
      return plural ? 'gramos' : 'gramo';
    case 'ml':
      return 'ml';
    case 'piezas':
      return plural ? 'piezas' : 'pieza';
    case 'unidades':
      return plural ? 'unidades' : 'unidad';
    default:
      return unidadRaw;
  }
}

function formatCantidadContinuaInventario(n: number): string {
  const s = n.toFixed(4).replace(/\.?0+$/, '');
  return s.length > 0 ? s : '0';
}

export function formatCantidadInventario(cantidad: number, unidadRaw: string): string {
  const u = normalizeUnidadMedida(unidadRaw);
  if (esUnidadDiscreta(u)) {
    const n = Math.round(cantidad);
    const label = etiquetaUnidad(u, { plural: Math.abs(n) !== 1 });
    return `${n} ${label}`;
  }
  return `${formatCantidadContinuaInventario(cantidad)} ${etiquetaUnidad(u)}`;
}

export function cantidadParaEdicion(cantidad: number, unidadRaw: string): string {
  if (esUnidadDiscreta(unidadRaw)) {
    return String(Math.round(cantidad));
  }
  return formatCantidadContinuaInventario(cantidad);
}

export function parseCantidadInventario(
  str: string,
  unidadRaw: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = String(str).replace(',', '.').trim();
  if (!trimmed) {
    return { ok: false, message: 'Indica una cantidad.' };
  }
  const q = Number(trimmed);
  if (!Number.isFinite(q)) {
    return { ok: false, message: 'Cantidad no válida.' };
  }
  if (esUnidadDiscreta(unidadRaw)) {
    if (!Number.isInteger(q)) {
      return {
        ok: false,
        message: `Para ${etiquetaUnidad(unidadRaw)} usa números enteros (sin decimales).`,
      };
    }
  }
  return { ok: true, value: q };
}

export function tecladoCantidadInventario(unidadRaw: string): 'number-pad' | 'decimal-pad' {
  return esUnidadDiscreta(unidadRaw) ? 'number-pad' : 'decimal-pad';
}

export function placeholderCantidadInventario(unidadRaw: string, esAjuste: boolean): string {
  if (esUnidadDiscreta(unidadRaw)) {
    return esAjuste ? '0' : 'Ej. 6';
  }
  return esAjuste ? '0' : 'Ej. 2.5';
}

export function etiquetaCampoCantidad(unidadRaw: string): string {
  return etiquetaUnidad(unidadRaw, { plural: true });
}
