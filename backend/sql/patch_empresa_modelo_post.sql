-- Modelos de post por empresa: estrutura FIXA (4 slugs do catálogo).
-- O lojista só altera `ativo` (ligar/desligar). Conteúdo do modelo vem do código, não do banco.

CREATE TABLE IF NOT EXISTS public.empresa_modelo_post (
    id_empresa_modelo_post uuid DEFAULT gen_random_uuid() NOT NULL,
    id_empresa uuid NOT NULL,
    playbook_slug character varying(80) NOT NULL,
    ativo boolean DEFAULT false NOT NULL,
    atualizado_por_usuario_id uuid,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL,
    data_atualizacao timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT empresa_modelo_post_pkey PRIMARY KEY (id_empresa_modelo_post),
    CONSTRAINT empresa_modelo_post_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
    CONSTRAINT empresa_modelo_post_atualizado_por_fkey FOREIGN KEY (atualizado_por_usuario_id) REFERENCES public.usuario(id_usuario),
    CONSTRAINT empresa_modelo_post_empresa_slug_unique UNIQUE (id_empresa, playbook_slug),
    CONSTRAINT empresa_modelo_post_playbook_slug_check CHECK (
        (playbook_slug)::text = ANY (
            (ARRAY['promocao'::character varying, 'lancamento'::character varying, 'produto'::character varying, 'mensagens'::character varying])::text[]
        )
    )
);

COMMENT ON TABLE public.empresa_modelo_post IS
    'Preferências fixas de modelos de post por empresa (apenas ativo/inativo por slug).';
COMMENT ON COLUMN public.empresa_modelo_post.playbook_slug IS
    'Slug do catálogo curado: promocao, lancamento, produto, mensagens.';
COMMENT ON COLUMN public.empresa_modelo_post.ativo IS
    'Se true, o modelo entra no chat e na geração de imagem para esta empresa.';

CREATE INDEX IF NOT EXISTS empresa_modelo_post_idx_empresa
    ON public.empresa_modelo_post USING btree (id_empresa);

CREATE INDEX IF NOT EXISTS empresa_modelo_post_idx_empresa_ativo
    ON public.empresa_modelo_post USING btree (id_empresa, ativo);

DROP TRIGGER IF EXISTS trg_empresa_modelo_post_set_data_atualizacao ON public.empresa_modelo_post;
CREATE TRIGGER trg_empresa_modelo_post_set_data_atualizacao
    BEFORE UPDATE ON public.empresa_modelo_post
    FOR EACH ROW EXECUTE FUNCTION public.set_data_atualizacao();

-- Garante as 4 linhas (ativo=false) para uma empresa.
CREATE OR REPLACE FUNCTION public.seed_empresa_modelos_post(p_id_empresa uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.empresa_modelo_post (id_empresa, playbook_slug, ativo)
    VALUES
        (p_id_empresa, 'promocao', false),
        (p_id_empresa, 'lancamento', false),
        (p_id_empresa, 'produto', false),
        (p_id_empresa, 'mensagens', false)
    ON CONFLICT (id_empresa, playbook_slug) DO NOTHING;
END;
$$;

-- Novas empresas já nascem com os 4 modelos (todos desligados).
CREATE OR REPLACE FUNCTION public.trg_empresa_seed_modelos_post_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM public.seed_empresa_modelos_post(NEW.id_empresa);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresa_seed_modelos_post ON public.empresa;
CREATE TRIGGER trg_empresa_seed_modelos_post
    AFTER INSERT ON public.empresa
    FOR EACH ROW EXECUTE FUNCTION public.trg_empresa_seed_modelos_post_fn();

-- Migra playbooks legados de contexto_empresa (antes de desativá-los).
INSERT INTO public.empresa_modelo_post (id_empresa, playbook_slug, ativo, atualizado_por_usuario_id, data_criacao)
SELECT DISTINCT ON (ce.id_empresa, mapped.slug)
    ce.id_empresa,
    mapped.slug,
    ce.ativo,
    ce.criado_por_usuario_id,
    ce.data_criacao
FROM public.contexto_empresa ce
CROSS JOIN LATERAL (
    SELECT CASE
        WHEN COALESCE(ce.dados_json->>'playbook_slug', '') IN ('data_comemorativa', 'lifestyle') THEN 'produto'
        WHEN COALESCE(ce.dados_json->>'playbook_slug', '') = 'institucional' THEN 'mensagens'
        WHEN COALESCE(ce.dados_json->>'playbook_slug', '') <> '' THEN ce.dados_json->>'playbook_slug'
        WHEN COALESCE(ce.schema_json->>'playbook_slug', '') <> '' THEN ce.schema_json->>'playbook_slug'
        ELSE NULL
    END AS slug
) mapped
WHERE (ce.dados_json->>'playbook')::text IN ('true', 't')
  AND mapped.slug IS NOT NULL
  AND mapped.slug IN ('promocao', 'lancamento', 'produto', 'mensagens')
ORDER BY ce.id_empresa, mapped.slug, ce.data_atualizacao DESC
ON CONFLICT (id_empresa, playbook_slug) DO UPDATE
SET ativo = EXCLUDED.ativo OR empresa_modelo_post.ativo,
    data_atualizacao = now();

-- Empresas existentes: completa slugs faltantes (estrutura fixa).
INSERT INTO public.empresa_modelo_post (id_empresa, playbook_slug, ativo)
SELECT e.id_empresa, s.slug, false
FROM public.empresa e
CROSS JOIN (
    VALUES
        ('promocao'::character varying),
        ('lancamento'::character varying),
        ('produto'::character varying),
        ('mensagens'::character varying)
) AS s(slug)
ON CONFLICT (id_empresa, playbook_slug) DO NOTHING;

UPDATE public.contexto_empresa
SET ativo = false,
    data_atualizacao = now()
WHERE (dados_json->>'playbook')::text IN ('true', 't');
