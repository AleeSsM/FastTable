/** Convierte texto en pesos (ej. "89.50") a centavos para `precio_centavos`. */
export function parsePrecioPesosToCentavos(raw: string): { ok: true; cents: number } | { ok: false } {
  const t = String(raw).replace(',', '.').trim();
  if (!t) return { ok: false };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, cents: Math.round(n * 100) };
}

export function centavosToPrecioInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
