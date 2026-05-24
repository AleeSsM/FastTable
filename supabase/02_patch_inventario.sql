-- =============================================================================
-- FastTable — Parche inventario (proyecto Supabase ya existente)
-- Ejecutar en SQL Editor si la pantalla Inventario pide el esquema o falla por "categoria".
-- No borra datos. Idempotente (se puede ejecutar más de una vez).
-- =============================================================================

BEGIN;

ALTER TABLE public.ingredientes
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'Ingredientes';

DO $$
BEGIN
  ALTER TABLE public.ingredientes
    ADD CONSTRAINT ingredientes_categoria_check
    CHECK (categoria IN ('Bebidas', 'Alimentos', 'Ingredientes', 'Otros'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ingredientes_categoria ON public.ingredientes (categoria);

UPDATE public.ingredientes i SET categoria = 'Alimentos'
WHERE i.categoria = 'Ingredientes' AND i.nombre IN (
  'Pan hamburguesa', 'Carne de hamburguesa', 'Queso cheddar', 'Bacon', 'Jamón serrano',
  'Costilla de cerdo', 'Mascarpone', 'Bizcocho savoiardi', 'Burrata', 'Atún fresco',
  'Pescado blanco', 'Chocolate postres', 'Helado vainilla', 'Huevos'
);

UPDATE public.ingredientes i SET categoria = 'Bebidas'
WHERE i.categoria = 'Ingredientes' AND i.nombre IN (
  'Café espresso', 'Agua filtrada', 'Agua embotellada', 'Malta cervecera', 'Lata refresco', 'Leche'
);

UPDATE public.ingredientes i SET categoria = 'Otros' WHERE i.nombre = 'Hielo';

COMMIT;
