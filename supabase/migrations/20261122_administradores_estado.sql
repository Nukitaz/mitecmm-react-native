ALTER TABLE public.administradores
  ADD COLUMN IF NOT EXISTS estado text;

UPDATE public.administradores
SET estado = 'activo'
WHERE estado IS NULL;

ALTER TABLE public.administradores
  ALTER COLUMN estado SET DEFAULT 'activo',
  ALTER COLUMN estado SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'administradores_estado_check'
      AND conrelid = 'public.administradores'::regclass
  ) THEN
    ALTER TABLE public.administradores
      ADD CONSTRAINT administradores_estado_check
      CHECK (estado IN ('pendiente', 'activo'));
  END IF;
END $$;
