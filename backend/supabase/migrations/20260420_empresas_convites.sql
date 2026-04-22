-- Empresas, vínculo usuário↔empresa e convites com código.
-- Execute no SQL Editor do Supabase (projeto) uma vez, na ordem.
-- Pré-requisito: tabela public.usuarios com coluna id_usuario (UUID PK).

-- ---------------------------------------------------------------------------
-- Empresa (cadastro principal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresas (
  id_empresa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT,
  descricao TEXT,
  instagram_empresa TEXT,
  telefone_principal TEXT,
  segmento TEXT,
  cnpj TEXT,
  email_principal TEXT,
  nome_contato_principal TEXT,
  plano_codigo TEXT NOT NULL DEFAULT 'nenhum',
  plano_status TEXT NOT NULL DEFAULT 'sem_plano',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresas_nome ON public.empresas (nome_fantasia);

-- ---------------------------------------------------------------------------
-- Membros: usuário vinculado a uma empresa (papéis)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresa_membros (
  id_empresa UUID NOT NULL REFERENCES public.empresas (id_empresa) ON DELETE CASCADE,
  id_usuario UUID NOT NULL REFERENCES public.usuarios (id_usuario) ON DELETE CASCADE,
  papel TEXT NOT NULL DEFAULT 'membro' CHECK (papel IN ('owner', 'admin', 'membro')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_empresa, id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_empresa_membros_usuario ON public.empresa_membros (id_usuario);

-- ---------------------------------------------------------------------------
-- Convites: código único para entrar na empresa
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresa_convites (
  id_convite UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES public.empresas (id_empresa) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  id_usuario_criador UUID NOT NULL REFERENCES public.usuarios (id_usuario),
  -- Convite expira automaticamente em 1 semana.
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  -- Por regra de negócio atual, todo convite é de uso único.
  max_usos INT NOT NULL DEFAULT 1 CHECK (max_usos = 1),
  usos INT NOT NULL DEFAULT 0 CHECK (usos >= 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT empresa_convites_usos_lim CHECK (usos <= max_usos),
  CONSTRAINT empresa_convites_codigo_unique UNIQUE (codigo)
);

CREATE INDEX IF NOT EXISTS idx_empresa_convites_codigo ON public.empresa_convites (codigo);

-- ---------------------------------------------------------------------------
-- RLS (opcional): o backend deste projeto usa service role e ignora RLS.
-- Se o front passar a usar Supabase direto com anon, defina políticas aqui.
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.empresas IS 'Cadastro de empresa (marca/negócio).';
COMMENT ON TABLE public.empresa_membros IS 'Vínculo usuário ↔ empresa com papel.';
COMMENT ON TABLE public.empresa_convites IS 'Código de convite para novos membros entrarem na empresa.';
