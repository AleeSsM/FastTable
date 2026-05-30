/** Normaliza códigos legacy (M1 → 1) para mostrar. */
export function mesaCodigoDisplay(codigo: string | null | undefined): string {
  if (!codigo?.trim()) return '—';
  const t = codigo.trim();
  if (/^M(\d+)$/i.test(t)) return t.slice(1);
  return t;
}

/** Etiqueta legible en UI: "Mesa 1". */
export function mesaEtiqueta(codigo: string | null | undefined): string {
  const c = mesaCodigoDisplay(codigo);
  if (c === '—') return 'Mesa —';
  return `Mesa ${c}`;
}

/** Para joins anidados { codigo } de Supabase (objeto o array). */
export function mesaEtiquetaFromJoin(
  mesas: { codigo?: string | null } | { codigo?: string | null }[] | null | undefined,
): string {
  if (mesas == null) return mesaEtiqueta(null);
  const row = Array.isArray(mesas) ? mesas[0] : mesas;
  return mesaEtiqueta(row?.codigo);
}
