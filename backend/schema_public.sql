--
-- PostgreSQL database dump
--

\restrict h4ddRtbEU72g3btkJoq1nisNQfODdc7xKedCMvlKgIbHQGJp8sROYce7vlIMuLA

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: set_data_atualizacao(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_data_atualizacao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

begin

  new.data_atualizacao = now();

  return new;

end;

$$;


ALTER FUNCTION public.set_data_atualizacao() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: aprovacao_post; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.aprovacao_post (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_post uuid DEFAULT gen_random_uuid() NOT NULL,
    id_usuario uuid DEFAULT gen_random_uuid() NOT NULL,
    status_aprovacao character varying NOT NULL,
    observacao text NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.aprovacao_post OWNER TO postgres;

--
-- Name: assinatura_empresa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assinatura_empresa (
    id_assinatura uuid DEFAULT gen_random_uuid() NOT NULL,
    id_empresa uuid DEFAULT gen_random_uuid() NOT NULL,
    id_plano uuid DEFAULT gen_random_uuid() NOT NULL,
    status character varying NOT NULL,
    data_inicio timestamp with time zone DEFAULT now() NOT NULL,
    data_fim timestamp with time zone DEFAULT now() NOT NULL,
    email_assinatura character varying NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.assinatura_empresa OWNER TO postgres;

--
-- Name: conta_empresa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conta_empresa (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_empresa uuid DEFAULT gen_random_uuid() NOT NULL,
    nome_conta character varying NOT NULL,
    tipo_conta character varying NOT NULL,
    identificador_externo character varying NOT NULL,
    token_acesso text NOT NULL,
    ativo boolean NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.conta_empresa OWNER TO postgres;

--
-- Name: contexto_empresa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contexto_empresa (
    id_contexto_empresa uuid DEFAULT gen_random_uuid() NOT NULL,
    id_empresa uuid NOT NULL,
    id_tipo_contexto uuid NOT NULL,
    id_template uuid NOT NULL,
    criado_por_usuario_id uuid NOT NULL,
    nome character varying NOT NULL,
    descricao text NOT NULL,
    origem character varying NOT NULL,
    schema_json jsonb NOT NULL,
    dados_json jsonb NOT NULL,
    ativo boolean NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL,
    data_atualizacao timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contextos_empresa_origem_check CHECK (((origem)::text = ANY ((ARRAY['manual'::character varying, 'api'::character varying, 'importacao'::character varying, 'demo'::character varying])::text[])))
);


ALTER TABLE public.contexto_empresa OWNER TO postgres;

--
-- Name: empresa_convite; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empresa_convite (
    id_convite uuid DEFAULT gen_random_uuid() NOT NULL,
    id_empresa uuid NOT NULL,
    id_usuario_criador uuid NOT NULL,
    codigo character varying(64) NOT NULL,
    token character varying(128),
    email_destino character varying(255),
    cargo character varying DEFAULT 'membro'::character varying NOT NULL,
    perfil_acesso character varying DEFAULT 'editor'::character varying NOT NULL,
    responsavel_operacional boolean DEFAULT false NOT NULL,
    receber_alertas boolean DEFAULT true NOT NULL,
    max_usos integer DEFAULT 1 NOT NULL,
    usos integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    data_expiracao timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL,
    data_atualizacao timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT empresas_convites_cargo_check CHECK (((cargo)::text = ANY ((ARRAY['membro'::character varying, 'editor'::character varying, 'administrador'::character varying])::text[]))),
    CONSTRAINT empresas_convites_max_usos_check CHECK ((max_usos = 1)),
    CONSTRAINT empresas_convites_perfil_check CHECK (((perfil_acesso)::text = ANY ((ARRAY['observador'::character varying, 'editor'::character varying, 'administrador'::character varying])::text[]))),
    CONSTRAINT empresas_convites_usos_check CHECK (((usos >= 0) AND (usos <= max_usos)))
);


ALTER TABLE public.empresa_convite OWNER TO postgres;

--
-- Name: empresa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empresa (
    id_empresa uuid DEFAULT gen_random_uuid() NOT NULL,
    razao_social character varying NOT NULL,
    nome_fantasia character varying NOT NULL,
    descricao text NOT NULL,
    instagram_empresa character varying NOT NULL,
    telefone_principal character varying NOT NULL,
    segmento character varying NOT NULL,
    cnpj character varying NOT NULL,
    email_principal character varying NOT NULL,
    nome_contato_principal character varying NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    data_atualizacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.empresa OWNER TO postgres;

--
-- Name: midia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.midia (
    id_midia uuid DEFAULT gen_random_uuid() NOT NULL,
    id_empresa uuid NOT NULL,
    id_pasta uuid NOT NULL,
    criado_por_usuario_id uuid NOT NULL,
    nome_arquivo character varying NOT NULL,
    nome_exibicao character varying NOT NULL,
    tipo_midia character varying NOT NULL,
    formato_arquivo character varying NOT NULL,
    url_arquivo text,
    caminho_storage text NOT NULL,
    extensao character varying NOT NULL,
    tamanho_bytes bigint NOT NULL,
    largura integer,
    altura integer,
    duracao_segundos integer,
    origem_upload character varying NOT NULL,
    descricao text,
    alt_text text,
    ativo boolean DEFAULT true NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL,
    data_atualizacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.midia OWNER TO postgres;

--
-- Name: COLUMN midia.formato_arquivo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.midia.formato_arquivo IS 'Tipo técnico do conteúdo (valores no padrão MIME, ex.: image/jpeg).';


--
-- Name: pasta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pasta (
    id_pasta uuid DEFAULT gen_random_uuid() NOT NULL,
    id_empresa uuid NOT NULL,
    id_pasta_pai uuid,
    nome character varying NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL,
    data_atualizacao timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pastas_sem_self_parent CHECK ((id_pasta_pai IS DISTINCT FROM id_pasta))
);


ALTER TABLE public.pasta OWNER TO postgres;

--
-- Name: TABLE pasta; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pasta IS 'Pastas de mídia por empresa; id_pasta_pai null = pasta na raiz.';


--
-- Name: plano; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plano (
    id_plano uuid DEFAULT gen_random_uuid() NOT NULL,
    nome character varying NOT NULL,
    descricao text NOT NULL,
    limite_usuarios integer NOT NULL,
    limite_posts_mes integer NOT NULL,
    limite_contas integer NOT NULL,
    valor_mensal numeric NOT NULL,
    ativo boolean NOT NULL
);


ALTER TABLE public.plano OWNER TO postgres;

--
-- Name: post_gerado; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_gerado (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_solicitacao uuid DEFAULT gen_random_uuid() NOT NULL,
    legenda text NOT NULL,
    hashtags text NOT NULL,
    prompt_utilizado text NOT NULL,
    url_imagem_gerada text NOT NULL,
    versao integer NOT NULL,
    aprovado boolean NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.post_gerado OWNER TO postgres;

--
-- Name: publicacao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.publicacao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_post uuid DEFAULT gen_random_uuid() NOT NULL,
    id_conta uuid DEFAULT gen_random_uuid() NOT NULL,
    status character varying NOT NULL,
    data_agendada timestamp with time zone DEFAULT now() NOT NULL,
    data_publicada timestamp with time zone DEFAULT now() NOT NULL,
    id_externo character varying NOT NULL,
    resposta_api text NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.publicacao OWNER TO postgres;

--
-- Name: solicitacao_post; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.solicitacao_post (
    id_solicitacao uuid DEFAULT gen_random_uuid() NOT NULL,
    id_empresa uuid DEFAULT gen_random_uuid() NOT NULL,
    id_usuario uuid DEFAULT gen_random_uuid() NOT NULL,
    id_contexto uuid DEFAULT gen_random_uuid() NOT NULL,
    id_conta uuid DEFAULT gen_random_uuid() NOT NULL,
    url_imagem text NOT NULL,
    hashtag character varying NOT NULL,
    descricao text NOT NULL,
    tipo_post character varying NOT NULL,
    status character varying NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.solicitacao_post OWNER TO postgres;

--
-- Name: template_contexto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.template_contexto (
    id_template uuid DEFAULT gen_random_uuid() NOT NULL,
    id_tipo_contexto uuid NOT NULL,
    nome character varying NOT NULL,
    descricao text NOT NULL,
    schema_json jsonb NOT NULL,
    ui_schema_json jsonb NOT NULL,
    prompt_base text NOT NULL,
    ativo boolean NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL,
    data_atualizacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.template_contexto OWNER TO postgres;

--
-- Name: tipo_contexto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tipo_contexto (
    id_tipo_contexto uuid DEFAULT gen_random_uuid() NOT NULL,
    nome character varying NOT NULL,
    descricao text NOT NULL,
    ativo boolean NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tipo_contexto OWNER TO postgres;

--
-- Name: usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario (
    id_usuario uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    nome character varying,
    email character varying,
    telefone character varying,
    ativo boolean DEFAULT true NOT NULL,
    data_criacao timestamp with time zone DEFAULT now()
);


ALTER TABLE public.usuario OWNER TO postgres;

--
-- Name: usuario_empresa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario_empresa (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_empresa uuid NOT NULL,
    id_usuario uuid NOT NULL,
    cargo character varying NOT NULL,
    perfil_acesso character varying NOT NULL,
    responsavel_operacional boolean NOT NULL,
    receber_alertas boolean NOT NULL,
    ativo boolean NOT NULL,
    data_criacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.usuario_empresa OWNER TO postgres;

--
-- Name: aprovacoes_post aprovacoes_post_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aprovacao_post
    ADD CONSTRAINT aprovacoes_post_pkey PRIMARY KEY (id);


--
-- Name: assinaturas_empresa assinaturas_empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assinatura_empresa
    ADD CONSTRAINT assinaturas_empresa_pkey PRIMARY KEY (id_assinatura);


--
-- Name: contas_empresa contas_empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conta_empresa
    ADD CONSTRAINT contas_empresa_pkey PRIMARY KEY (id);


--
-- Name: contextos_empresa contextos_empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contexto_empresa
    ADD CONSTRAINT contextos_empresa_pkey PRIMARY KEY (id_contexto_empresa);


--
-- Name: empresas empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_pkey PRIMARY KEY (id_empresa);


--
-- Name: empresa_convites empresas_convites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa_convite
    ADD CONSTRAINT empresas_convites_pkey PRIMARY KEY (id_convite);


--
-- Name: empresa_convites empresas_convites_token_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa_convite
    ADD CONSTRAINT empresas_convites_token_unique UNIQUE (token);


--
-- Name: midias midias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.midia
    ADD CONSTRAINT midias_pkey PRIMARY KEY (id_midia);


--
-- Name: pastas pastas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pasta
    ADD CONSTRAINT pastas_pkey PRIMARY KEY (id_pasta);


--
-- Name: planos planos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plano
    ADD CONSTRAINT planos_pkey PRIMARY KEY (id_plano);


--
-- Name: posts_gerados posts_gerados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_gerado
    ADD CONSTRAINT posts_gerados_pkey PRIMARY KEY (id);


--
-- Name: publicacoes publicacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.publicacao
    ADD CONSTRAINT publicacoes_pkey PRIMARY KEY (id);


--
-- Name: solicitacoes_post solicitacoes_post_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitacao_post
    ADD CONSTRAINT solicitacoes_post_pkey PRIMARY KEY (id_solicitacao);


--
-- Name: templates_contexto templates_contexto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.template_contexto
    ADD CONSTRAINT templates_contexto_pkey PRIMARY KEY (id_template);


--
-- Name: tipos_contexto tipos_contexto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_contexto
    ADD CONSTRAINT tipos_contexto_pkey PRIMARY KEY (id_tipo_contexto);


--
-- Name: usuarios_empresa usuarios_empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_empresa
    ADD CONSTRAINT usuarios_empresa_pkey PRIMARY KEY (id);


--
-- Name: usuarios_empresa usuarios_empresa_unique_usuario_empresa; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_empresa
    ADD CONSTRAINT usuarios_empresa_unique_usuario_empresa UNIQUE (id_usuario, id_empresa);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario);


--
-- Name: contextos_empresa_idx_criador; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contexto_empresa_idx_criador ON public.contexto_empresa USING btree (criado_por_usuario_id);


--
-- Name: contextos_empresa_idx_empresa_ativo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contexto_empresa_idx_empresa_ativo ON public.contexto_empresa USING btree (id_empresa, ativo);


--
-- Name: contextos_empresa_idx_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contexto_empresa_idx_template ON public.contexto_empresa USING btree (id_template);


--
-- Name: contextos_empresa_idx_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contexto_empresa_idx_tipo ON public.contexto_empresa USING btree (id_tipo_contexto);


--
-- Name: empresa_cnpj_unique_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX empresa_cnpj_unique_idx ON public.empresa USING btree (cnpj);


--
-- Name: empresa_nome_fantasia_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX empresa_nome_fantasia_idx ON public.empresa USING btree (nome_fantasia);


--
-- Name: empresas_convites_codigo_upper_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX empresa_convite_codigo_upper_unique ON public.empresa_convite USING btree (upper(TRIM(BOTH FROM codigo)));


--
-- Name: empresas_convites_idx_codigo_ativo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX empresa_convite_idx_codigo_ativo ON public.empresa_convite USING btree (codigo, ativo);


--
-- Name: empresas_convites_idx_email_destino; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX empresa_convite_idx_email_destino ON public.empresa_convite USING btree (email_destino);


--
-- Name: empresas_convites_idx_empresa_ativo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX empresa_convite_idx_empresa_ativo ON public.empresa_convite USING btree (id_empresa, ativo);


--
-- Name: midias_id_empresa_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX midia_id_empresa_idx ON public.midia USING btree (id_empresa);


--
-- Name: midias_id_pasta_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX midia_id_pasta_idx ON public.midia USING btree (id_pasta);


--
-- Name: pastas_id_empresa_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pasta_id_empresa_idx ON public.pasta USING btree (id_empresa);


--
-- Name: pastas_id_pasta_pai_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pasta_id_pasta_pai_idx ON public.pasta USING btree (id_pasta_pai);


--
-- Name: pastas_nome_unico_filho; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX pasta_nome_unico_filho ON public.pasta USING btree (id_empresa, id_pasta_pai, nome) WHERE (id_pasta_pai IS NOT NULL);


--
-- Name: pastas_nome_unico_raiz; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX pasta_nome_unico_raiz ON public.pasta USING btree (id_empresa, nome) WHERE (id_pasta_pai IS NULL);


--
-- Name: templates_contexto_tipo_ativo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX template_contexto_tipo_ativo_idx ON public.template_contexto USING btree (id_tipo_contexto, ativo);


--
-- Name: templates_contexto_tipo_nome_unique_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX template_contexto_tipo_nome_unique_idx ON public.template_contexto USING btree (id_tipo_contexto, lower((nome)::text));


--
-- Name: tipos_contexto_ativo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tipo_contexto_ativo_idx ON public.tipo_contexto USING btree (ativo);


--
-- Name: tipos_contexto_nome_unique_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tipo_contexto_nome_unique_idx ON public.tipo_contexto USING btree (lower((nome)::text));


--
-- Name: usuarios_empresa_idx_empresa_ativo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX usuario_empresa_idx_empresa_ativo ON public.usuario_empresa USING btree (id_empresa, ativo);


--
-- Name: usuarios_empresa_idx_usuario_ativo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX usuario_empresa_idx_usuario_ativo ON public.usuario_empresa USING btree (id_usuario, ativo);


--
-- Name: contextos_empresa trg_contextos_empresa_set_data_atualizacao; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_contexto_empresa_set_data_atualizacao BEFORE UPDATE ON public.contexto_empresa FOR EACH ROW EXECUTE FUNCTION public.set_data_atualizacao();


--
-- Name: empresa_convites trg_empresas_convites_set_data_atualizacao; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_empresa_convite_set_data_atualizacao BEFORE UPDATE ON public.empresa_convite FOR EACH ROW EXECUTE FUNCTION public.set_data_atualizacao();


--
-- Name: aprovacoes_post aprovacoes_post_id_post_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aprovacao_post
    ADD CONSTRAINT aprovacao_post_id_post_fkey FOREIGN KEY (id_post) REFERENCES public.post_gerado(id);


--
-- Name: aprovacoes_post aprovacoes_post_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aprovacao_post
    ADD CONSTRAINT aprovacao_post_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- Name: assinaturas_empresa assinaturas_empresa_id_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assinatura_empresa
    ADD CONSTRAINT assinatura_empresa_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresa(id_empresa);


--
-- Name: assinaturas_empresa assinaturas_empresa_id_plano_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assinatura_empresa
    ADD CONSTRAINT assinatura_empresa_id_plano_fkey FOREIGN KEY (id_plano) REFERENCES public.plano(id_plano);


--
-- Name: contas_empresa contas_empresa_id_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conta_empresa
    ADD CONSTRAINT conta_empresa_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresa(id_empresa);


--
-- Name: contextos_empresa contextos_empresa_criado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contexto_empresa
    ADD CONSTRAINT contexto_empresa_criado_por_usuario_id_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES public.usuario(id_usuario);


--
-- Name: contextos_empresa contextos_empresa_id_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contexto_empresa
    ADD CONSTRAINT contexto_empresa_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresa(id_empresa);


--
-- Name: contextos_empresa contextos_empresa_id_template_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contexto_empresa
    ADD CONSTRAINT contexto_empresa_id_template_fkey FOREIGN KEY (id_template) REFERENCES public.template_contexto(id_template);


--
-- Name: contextos_empresa contextos_empresa_id_tipo_contexto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contexto_empresa
    ADD CONSTRAINT contexto_empresa_id_tipo_contexto_fkey FOREIGN KEY (id_tipo_contexto) REFERENCES public.tipo_contexto(id_tipo_contexto);


--
-- Name: empresa_convites empresas_convites_id_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa_convite
    ADD CONSTRAINT empresa_convite_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresa(id_empresa) ON DELETE CASCADE;


--
-- Name: empresa_convites empresas_convites_id_usuario_criador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa_convite
    ADD CONSTRAINT empresa_convite_id_usuario_criador_fkey FOREIGN KEY (id_usuario_criador) REFERENCES public.usuario(id_usuario) ON DELETE RESTRICT;


--
-- Name: midias midias_criado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.midia
    ADD CONSTRAINT midia_criado_por_usuario_id_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES public.usuario(id_usuario);


--
-- Name: midias midias_id_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.midia
    ADD CONSTRAINT midia_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresa(id_empresa) ON DELETE CASCADE;


--
-- Name: midias midias_id_pasta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.midia
    ADD CONSTRAINT midia_id_pasta_fkey FOREIGN KEY (id_pasta) REFERENCES public.pasta(id_pasta) ON DELETE RESTRICT;


--
-- Name: pastas pastas_id_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pasta
    ADD CONSTRAINT pasta_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresa(id_empresa) ON DELETE CASCADE;


--
-- Name: pastas pastas_id_pasta_pai_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pasta
    ADD CONSTRAINT pasta_id_pasta_pai_fkey FOREIGN KEY (id_pasta_pai) REFERENCES public.pasta(id_pasta) ON DELETE RESTRICT;


--
-- Name: posts_gerados posts_gerados_id_solicitacao_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_gerado
    ADD CONSTRAINT post_gerado_id_solicitacao_fkey FOREIGN KEY (id_solicitacao) REFERENCES public.solicitacao_post(id_solicitacao);


--
-- Name: publicacoes publicacoes_id_conta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.publicacao
    ADD CONSTRAINT publicacao_id_conta_fkey FOREIGN KEY (id_conta) REFERENCES public.conta_empresa(id);


--
-- Name: publicacoes publicacoes_id_post_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.publicacao
    ADD CONSTRAINT publicacao_id_post_fkey FOREIGN KEY (id_post) REFERENCES public.post_gerado(id);


--
-- Name: solicitacoes_post solicitacoes_post_id_conta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitacao_post
    ADD CONSTRAINT solicitacao_post_id_conta_fkey FOREIGN KEY (id_conta) REFERENCES public.conta_empresa(id);


--
-- Name: solicitacoes_post solicitacoes_post_id_contexto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitacao_post
    ADD CONSTRAINT solicitacao_post_id_contexto_fkey FOREIGN KEY (id_contexto) REFERENCES public.contexto_empresa(id_contexto_empresa);


--
-- Name: solicitacoes_post solicitacoes_post_id_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitacao_post
    ADD CONSTRAINT solicitacao_post_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresa(id_empresa);


--
-- Name: solicitacoes_post solicitacoes_post_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitacao_post
    ADD CONSTRAINT solicitacao_post_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- Name: templates_contexto templates_contexto_id_tipo_contexto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.template_contexto
    ADD CONSTRAINT template_contexto_id_tipo_contexto_fkey FOREIGN KEY (id_tipo_contexto) REFERENCES public.tipo_contexto(id_tipo_contexto);


--
-- Name: usuarios usuarios_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuarios_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);


--
-- Name: usuarios_empresa usuarios_empresa_id_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_empresa
    ADD CONSTRAINT usuario_empresa_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresa(id_empresa);


--
-- Name: usuarios_empresa usuarios_empresa_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_empresa
    ADD CONSTRAINT usuario_empresa_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- Name: aprovacoes_post; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.aprovacao_post ENABLE ROW LEVEL SECURITY;

--
-- Name: assinaturas_empresa; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.assinatura_empresa ENABLE ROW LEVEL SECURITY;

--
-- Name: contas_empresa; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conta_empresa ENABLE ROW LEVEL SECURITY;

--
-- Name: contextos_empresa; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contexto_empresa ENABLE ROW LEVEL SECURITY;

--
-- Name: empresa_convites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.empresa_convite ENABLE ROW LEVEL SECURITY;

--
-- Name: empresas; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;

--
-- Name: midias; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.midia ENABLE ROW LEVEL SECURITY;

--
-- Name: pastas; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pasta ENABLE ROW LEVEL SECURITY;

--
-- Name: planos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.plano ENABLE ROW LEVEL SECURITY;

--
-- Name: posts_gerados; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.post_gerado ENABLE ROW LEVEL SECURITY;

--
-- Name: publicacoes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.publicacao ENABLE ROW LEVEL SECURITY;

--
-- Name: solicitacoes_post; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.solicitacao_post ENABLE ROW LEVEL SECURITY;

--
-- Name: templates_contexto; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.template_contexto ENABLE ROW LEVEL SECURITY;

--
-- Name: tipos_contexto; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tipo_contexto ENABLE ROW LEVEL SECURITY;

--
-- Name: usuarios; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: usuarios_empresa; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.usuario_empresa ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION set_data_atualizacao(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_data_atualizacao() TO anon;
GRANT ALL ON FUNCTION public.set_data_atualizacao() TO authenticated;
GRANT ALL ON FUNCTION public.set_data_atualizacao() TO service_role;


--
-- Name: TABLE aprovacoes_post; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.aprovacao_post TO anon;
GRANT ALL ON TABLE public.aprovacao_post TO authenticated;
GRANT ALL ON TABLE public.aprovacao_post TO service_role;


--
-- Name: TABLE assinaturas_empresa; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.assinatura_empresa TO anon;
GRANT ALL ON TABLE public.assinatura_empresa TO authenticated;
GRANT ALL ON TABLE public.assinatura_empresa TO service_role;


--
-- Name: TABLE contas_empresa; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conta_empresa TO anon;
GRANT ALL ON TABLE public.conta_empresa TO authenticated;
GRANT ALL ON TABLE public.conta_empresa TO service_role;


--
-- Name: TABLE contextos_empresa; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contexto_empresa TO anon;
GRANT ALL ON TABLE public.contexto_empresa TO authenticated;
GRANT ALL ON TABLE public.contexto_empresa TO service_role;


--
-- Name: TABLE empresa_convites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.empresa_convite TO anon;
GRANT ALL ON TABLE public.empresa_convite TO authenticated;
GRANT ALL ON TABLE public.empresa_convite TO service_role;


--
-- Name: TABLE empresas; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.empresa TO anon;
GRANT ALL ON TABLE public.empresa TO authenticated;
GRANT ALL ON TABLE public.empresa TO service_role;


--
-- Name: TABLE midias; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.midia TO anon;
GRANT ALL ON TABLE public.midia TO authenticated;
GRANT ALL ON TABLE public.midia TO service_role;


--
-- Name: TABLE pastas; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pasta TO anon;
GRANT ALL ON TABLE public.pasta TO authenticated;
GRANT ALL ON TABLE public.pasta TO service_role;


--
-- Name: TABLE planos; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.plano TO anon;
GRANT ALL ON TABLE public.plano TO authenticated;
GRANT ALL ON TABLE public.plano TO service_role;


--
-- Name: TABLE posts_gerados; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.post_gerado TO anon;
GRANT ALL ON TABLE public.post_gerado TO authenticated;
GRANT ALL ON TABLE public.post_gerado TO service_role;


--
-- Name: TABLE publicacoes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.publicacao TO anon;
GRANT ALL ON TABLE public.publicacao TO authenticated;
GRANT ALL ON TABLE public.publicacao TO service_role;


--
-- Name: TABLE solicitacoes_post; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.solicitacao_post TO anon;
GRANT ALL ON TABLE public.solicitacao_post TO authenticated;
GRANT ALL ON TABLE public.solicitacao_post TO service_role;


--
-- Name: TABLE templates_contexto; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.template_contexto TO anon;
GRANT ALL ON TABLE public.template_contexto TO authenticated;
GRANT ALL ON TABLE public.template_contexto TO service_role;


--
-- Name: TABLE tipos_contexto; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tipo_contexto TO anon;
GRANT ALL ON TABLE public.tipo_contexto TO authenticated;
GRANT ALL ON TABLE public.tipo_contexto TO service_role;


--
-- Name: TABLE usuarios; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.usuario TO anon;
GRANT ALL ON TABLE public.usuario TO authenticated;
GRANT ALL ON TABLE public.usuario TO service_role;


--
-- Name: TABLE usuarios_empresa; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.usuario_empresa TO anon;
GRANT ALL ON TABLE public.usuario_empresa TO authenticated;
GRANT ALL ON TABLE public.usuario_empresa TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict h4ddRtbEU72g3btkJoq1nisNQfODdc7xKedCMvlKgIbHQGJp8sROYce7vlIMuLA

