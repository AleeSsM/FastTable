-- =============================================================================
-- FastTable — Parche unidades de inventario (proyecto ya desplegado)
-- Normaliza unidad_medida y convierte embotellados a piezas.
-- Idempotente. No modifica RPCs.
-- =============================================================================

BEGIN;

UPDATE public.ingredientes SET unidad_medida = 'g'
WHERE lower(unidad_medida) IN ('gramo', 'gramos', 'gr');

UPDATE public.ingredientes SET unidad_medida = 'piezas'
WHERE lower(unidad_medida) IN ('pieza', 'pza', 'pzas');

UPDATE public.ingredientes SET unidad_medida = 'unidades'
WHERE lower(unidad_medida) = 'unidad';

UPDATE public.ingredientes i
SET
  unidad_medida = 'piezas',
  cantidad_disponible = GREATEST(1, ROUND(i.cantidad_disponible / 750.0)),
  stock_minimo = CASE
    WHEN i.stock_minimo IS NOT NULL THEN GREATEST(1, ROUND(i.stock_minimo / 750.0))
    ELSE NULL
  END
WHERE i.nombre = 'Agua embotellada' AND i.unidad_medida = 'ml';

UPDATE public.receta_ingredientes
SET cantidad_por_plato = 1
WHERE id IN (
  SELECT ri.id
  FROM public.receta_ingredientes ri
  INNER JOIN public.ingredientes ing ON ing.id = ri.id_ingrediente
  INNER JOIN public.recetas r ON r.id = ri.id_receta
  INNER JOIN public.items_menu im ON im.id = r.id_item_menu
  WHERE ing.nombre = 'Agua embotellada'
    AND im.nombre = 'Agua mineral'
    AND ri.cantidad_por_plato >= 100
);

DO $$
BEGIN
  ALTER TABLE public.ingredientes
    ADD CONSTRAINT ingredientes_unidad_medida_check
    CHECK (unidad_medida IN ('g', 'ml', 'piezas', 'unidades'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
