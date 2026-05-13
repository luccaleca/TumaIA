-- Alinha tabela contexto_empresa com schema_public.sql (coluna origem + default).
-- Rode no Supabase: SQL Editor → New query → colar e executar.
-- Idempotente: seguro rodar mais de uma vez.

ALTER TABLE public.contexto_empresa
  ADD COLUMN IF NOT EXISTS origem character varying;

UPDATE public.contexto_empresa
SET origem = 'manual'
WHERE origem IS NULL OR trim(origem::text) = '';

ALTER TABLE public.contexto_empresa
  ALTER COLUMN origem SET DEFAULT 'manual',
  ALTER COLUMN origem SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contextos_empresa_origem_check'
  ) THEN
    ALTER TABLE public.contexto_empresa
      ADD CONSTRAINT contextos_empresa_origem_check
      CHECK (((origem)::text = ANY ((ARRAY['manual'::character varying, 'api'::character varying, 'importacao'::character varying, 'demo'::character varying])::text[])));
  END IF;
END $$;
