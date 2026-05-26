-- Última empresa usada no painel (chat, mídias, contextos).
ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS id_empresa_ultima uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuario_id_empresa_ultima_fkey'
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT usuario_id_empresa_ultima_fkey
      FOREIGN KEY (id_empresa_ultima)
      REFERENCES public.empresa (id_empresa)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS usuario_idx_empresa_ultima
  ON public.usuario (id_empresa_ultima)
  WHERE id_empresa_ultima IS NOT NULL;
