-- Rode APENAS se já executou patch_empresa_modelo_post.sql antes desta versão.
-- Adiciona CHECK, seed das 4 linhas por empresa e trigger em novas empresas.

ALTER TABLE public.empresa_modelo_post
    DROP CONSTRAINT IF EXISTS empresa_modelo_post_playbook_slug_check;

ALTER TABLE public.empresa_modelo_post
    ADD CONSTRAINT empresa_modelo_post_playbook_slug_check CHECK (
        (playbook_slug)::text = ANY (
            (ARRAY['promocao'::character varying, 'lancamento'::character varying, 'produto'::character varying, 'mensagens'::character varying])::text[]
        )
    );

COMMENT ON TABLE public.empresa_modelo_post IS
    'Preferências fixas de modelos de post por empresa (apenas ativo/inativo por slug).';

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

SELECT public.seed_empresa_modelos_post(id_empresa) FROM public.empresa;
