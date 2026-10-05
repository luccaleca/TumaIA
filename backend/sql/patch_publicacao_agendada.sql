-- Posts do Instagram agendados para publicar depois.
-- Rode no Supabase: SQL Editor -> New query -> colar e executar.
-- Idempotente: seguro rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS public.publicacao_agendada (
  id_publicacao_agendada uuid DEFAULT gen_random_uuid() NOT NULL,
  id_empresa uuid NOT NULL,
  criado_por_usuario_id uuid NOT NULL,
  legenda text NOT NULL,
  image_storage_path text NOT NULL,
  agendada_para timestamp with time zone NOT NULL,
  status character varying NOT NULL DEFAULT 'agendado',
  tentativas integer NOT NULL DEFAULT 0,
  erro text,
  id_externo character varying,
  data_publicada timestamp with time zone,
  data_criacao timestamp with time zone NOT NULL DEFAULT now(),
  data_atualizacao timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'publicacao_agendada_pkey'
  ) THEN
    ALTER TABLE public.publicacao_agendada
      ADD CONSTRAINT publicacao_agendada_pkey
      PRIMARY KEY (id_publicacao_agendada);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'publicacao_agendada_id_empresa_fkey'
  ) THEN
    ALTER TABLE public.publicacao_agendada
      ADD CONSTRAINT publicacao_agendada_id_empresa_fkey
      FOREIGN KEY (id_empresa)
      REFERENCES public.empresa (id_empresa)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'publicacao_agendada_criado_por_usuario_id_fkey'
  ) THEN
    ALTER TABLE public.publicacao_agendada
      ADD CONSTRAINT publicacao_agendada_criado_por_usuario_id_fkey
      FOREIGN KEY (criado_por_usuario_id)
      REFERENCES public.usuario (id_usuario)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'publicacao_agendada_status_check'
  ) THEN
    ALTER TABLE public.publicacao_agendada
      ADD CONSTRAINT publicacao_agendada_status_check
      CHECK (
        (status)::text = ANY (
          (
            ARRAY[
              'agendado'::character varying,
              'publicando'::character varying,
              'publicado'::character varying,
              'falhou'::character varying,
              'cancelado'::character varying
            ]
          )::text[]
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS publicacao_agendada_idx_status_data
  ON public.publicacao_agendada (status, agendada_para);

CREATE INDEX IF NOT EXISTS publicacao_agendada_idx_empresa_data
  ON public.publicacao_agendada (id_empresa, agendada_para DESC);
