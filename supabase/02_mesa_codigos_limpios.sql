-- Renombra códigos demo M1…M4 → 1…4 (ejecutar una vez en proyectos ya desplegados).
-- Instalaciones nuevas: ya vienen en 01_schema_bootstrap.sql.

UPDATE public.mesas SET codigo = '1' WHERE codigo = 'M1';
UPDATE public.mesas SET codigo = '2' WHERE codigo = 'M2';
UPDATE public.mesas SET codigo = '3' WHERE codigo = 'M3';
UPDATE public.mesas SET codigo = '4' WHERE codigo = 'M4';
