-- Job persistido da análise de identidade da marca.
-- Rode no Supabase: SQL Editor -> New query -> colar e executar.
-- Idempotente: seguro rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS public.identidade_analise_job (
  id_identidade_analise_job uuid DEFAULT gen_random_uuid() NOT NULL,
  id_empresa uuid NOT NULL,
  criado_por_usuario_id uuid NOT NULL,
  status character varying NOT NULL DEFAULT 'queued',
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  progresso_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  dados_base_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  dados_resultado_json jsonb,
  erro text,
  data_criacao timestamp with time zone NOT NULL DEFAULT now(),
  data_atualizacao timestamp with time zone NOT NULL DEFAULT now(),
  data_inicio timestamp with time zone,
  data_fim timestamp with time zone
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'identidade_analise_job_pkey'
  ) THEN
    ALTER TABLE public.identidade_analise_job
      ADD CONSTRAINT identidade_analise_job_pkey
      PRIMARY KEY (id_identidade_analise_job);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'identidade_analise_job_id_empresa_fkey'
  ) THEN
    ALTER TABLE public.identidade_analise_job
      ADD CONSTRAINT identidade_analise_job_id_empresa_fkey
      FOREIGN KEY (id_empresa)
      REFERENCES public.empresa (id_empresa)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'identidade_analise_job_criado_por_usuario_id_fkey'
  ) THEN
    ALTER TABLE public.identidade_analise_job
      ADD CONSTRAINT identidade_analise_job_criado_por_usuario_id_fkey
      FOREIGN KEY (criado_por_usuario_id)
      REFERENCES public.usuario (id_usuario)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'identidade_analise_job_status_check'
  ) THEN
    ALTER TABLE public.identidade_analise_job
      ADD CONSTRAINT identidade_analise_job_status_check
      CHECK (
        (status)::text = ANY (
          (
            ARRAY[
              'queued'::character varying,
              'running'::character varying,
              'completed'::character varying,
              'failed'::character varying
            ]
          )::text[]
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS identidade_analise_job_idx_empresa_data
  ON public.identidade_analise_job (id_empresa, data_criacao DESC);

CREATE INDEX IF NOT EXISTS identidade_analise_job_idx_empresa_status
  ON public.identidade_analise_job (id_empresa, status, data_criacao DESC);
