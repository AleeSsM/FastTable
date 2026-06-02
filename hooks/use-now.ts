import { useEffect, useState } from 'react';

/** Hora actual que se refresca periódicamente (p. ej. habilitar “Comensal no llegó”). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
