"""Montagem do prompt e resposta principal (RAG + schema + histórico)."""

from concurrent.futures import ThreadPoolExecutor

from langchain_chroma import Chroma

try:
    from .. import schema_supabase
except ImportError:
    import schema_supabase

from .historico import formatar_historico_prompt, normalizar_historico
from .identidade import (
    bloco_fatos_identidade_para_prompt,
    resposta_cordial_curta,
    resposta_followup_nome,
    resposta_identidade,
)
from .instrucoes import (
    PROMPT_RAG,
    REGRAS_TUMA_IA,
    REGRAS_INTERPRETACAO_TUMA,
    SCHEMA_INSTR_SQL,
    ESTILO_CONVERSA,
    PEDIDOS_POST_BREVE,
    SEM_META_RESPOSTA,
    SQL_SELECT_FOCUS,
)

_IDENTIDADE_TUMA_PROMPT = (
    "Você é o Tuma, a IA de conteúdo do TumaIA: posts e artes para Instagram da empresa em sessão, "
    "como um funcionário de marketing dessa empresa. Amigável, em português do Brasil.\n"
)
from .pedidos_post import pergunta_sobre_post_redes
from .provedores import llm_para_contexto
from .recuperacao_contexto import (
    deve_anexar_schema_postgres,
    deve_pular_rag_para_sql,
    pergunta_quer_contexto_postgres,
    recuperar_documentos_para_resposta,
)

# Io paralelo (Postgres/embeddings+Chroma) sem bloquear um ao outro.
_pool_ia = ThreadPoolExecutor(max_workers=4, thread_name_prefix="tumacore_ia")

_POST_RESPOSTA_MAX_CHARS = 320


def _truncar_resposta_pedido_post(texto: str) -> str:
    """Garante resposta curta mesmo se o modelo ignorar instruções."""
    t = (texto or "").strip()
    if len(t) <= _POST_RESPOSTA_MAX_CHARS:
        return t
    cortado = t[:_POST_RESPOSTA_MAX_CHARS]
    ultimo_ponto = max(cortado.rfind(". "), cortado.rfind("! "), cortado.rfind("? "))
    if ultimo_ponto > 80:
        return cortado[: ultimo_ponto + 1].strip()
    return cortado.rstrip() + "…"


def responder_mensagem(
    vetor_store: Chroma,
    pergunta: str,
    history: list[dict] | None = None,
    id_empresa: str | None = None,
) -> dict:
    """
    Responde à pergunta. Só preenche source_documents quando trechos do índice
    foram selecionados para compor o contexto (aí faz sentido mostrar fontes).

    Perguntas sobre SQL/banco disparam leitura do schema Postgres (cache TTL),
    sem precisar atualizar arquivos em contextos/.

    Se ``id_empresa`` for informado (UUID da empresa em sessão), lê ``public.empresa``
    no Postgres e injeta o cadastro no prompt para o modelo usar dados reais.
    """
    q = pergunta.strip()
    historico = normalizar_historico(history)
    rid = resposta_identidade(q)
    if rid:
        return {"result": rid, "source_documents": []}

    resposta_follow = resposta_followup_nome(q, historico)
    if resposta_follow:
        return {"result": resposta_follow, "source_documents": []}
    resposta_cordial = resposta_cordial_curta(q)
    if resposta_cordial:
        return {"result": resposta_cordial, "source_documents": []}

    # Roteamento de modelo: pergunta de banco/SQL -> modelo rápido;
    # demais assuntos -> modelo principal (mais capaz).
    eh_sql_ou_banco = pergunta_quer_contexto_postgres(q)
    quer_pg = deve_anexar_schema_postgres(q)
    schema_text: str | None = None
    schema_err: str | None = None

    pular_rag_sql = deve_pular_rag_para_sql(q)

    if quer_pg and not pular_rag_sql:
        f_schema = _pool_ia.submit(schema_supabase.obter_resumo_schema_cacheado)
        f_docs = _pool_ia.submit(recuperar_documentos_para_resposta, vetor_store, q)
        schema_text, schema_err = f_schema.result()
        docs = f_docs.result()
    elif quer_pg and pular_rag_sql:
        schema_text, schema_err = schema_supabase.obter_resumo_schema_cacheado()
        docs = []
    else:
        docs = recuperar_documentos_para_resposta(vetor_store, q)

    modelo = llm_para_contexto(sql_context=eh_sql_ou_banco)
    bloco_historico = formatar_historico_prompt(historico)
    bloco_fatos = bloco_fatos_identidade_para_prompt(historico, q)
    bloco_post_breve = f"{PEDIDOS_POST_BREVE}\n\n" if pergunta_sobre_post_redes(q) else ""

    bloco_empresa = ""
    if id_empresa:
        empresa_row, emp_err = schema_supabase.obter_empresa_cadastro_por_id(str(id_empresa).strip())
        if empresa_row:
            bloco_empresa = schema_supabase.formatar_empresa_cadastro_prompt(empresa_row)
        elif emp_err:
            bloco_empresa = (
                "[AVISO: não foi possível carregar o cadastro da empresa em sessão]\n" + emp_err
            )

    bloco_schema = ""
    if quer_pg:
        if schema_text:
            bloco_schema = (
                "[SCHEMA ATUAL DO POSTGRES — lido do banco (atualiza conforme o cache; "
                "veja TUMACORE_SCHEMA_CACHE_TTL_SECONDS no .env)]\n\n"
                + schema_text.strip()
            )
        elif schema_err:
            bloco_schema = (
                "[AVISO: não foi possível ler o schema do banco agora]\n" + schema_err
            )
        else:
            bloco_schema = (
                "[CONFIGURAÇÃO: defina SUPABASE_DATABASE_URL em config/.env com a URI do Postgres "
                "(Supabase → Settings → Database) para eu ver tabelas/colunas e gerar SQL alinhado ao projeto.]"
            )

    if not docs:
        if bloco_schema:
            msg = modelo.invoke(
                _IDENTIDADE_TUMA_PROMPT
                + f"{SEM_META_RESPOSTA}\n"
                + f"{ESTILO_CONVERSA}\n"
                + f"{REGRAS_TUMA_IA}\n\n"
                + f"{REGRAS_INTERPRETACAO_TUMA}\n\n"
                + bloco_post_breve
                + (f"{bloco_empresa}\n\n" if bloco_empresa else "")
                + (f"{bloco_fatos}\n" if bloco_fatos else "")
                + f"{SQL_SELECT_FOCUS}\n\n"
                + f"{SCHEMA_INSTR_SQL}\n\n"
                + (f"{bloco_historico}\n\n" if bloco_historico else "")
                + f"{bloco_schema}\n\n"
                + "Responda à mensagem do usuário de forma natural. "
                + "Não diga que consultou 'information_schema' nem cite nomes internos de ferramenta.\n\n"
                + f"Usuário: {q}"
            )
        else:
            msg = modelo.invoke(
                _IDENTIDADE_TUMA_PROMPT
                + f"{SEM_META_RESPOSTA}\n"
                + f"{ESTILO_CONVERSA}\n"
                + f"{REGRAS_TUMA_IA}\n\n"
                + f"{REGRAS_INTERPRETACAO_TUMA}\n\n"
                + bloco_post_breve
                + (f"{bloco_empresa}\n\n" if bloco_empresa else "")
                + (f"{bloco_fatos}\n" if bloco_fatos else "")
                + (f"{bloco_historico}\n" if bloco_historico else "")
                + "Responda à mensagem do usuário de forma natural. "
                + "Não cite documentos internos nem fontes (não há trecho aplicável da base agora).\n\n"
                + f"Usuário: {q}"
            )
        text = msg.content if hasattr(msg, "content") else str(msg)
        if pergunta_sobre_post_redes(q):
            text = _truncar_resposta_pedido_post(text)
        return {"result": text, "source_documents": []}

    context = "\n\n---\n\n".join(d.page_content for d in docs)
    if bloco_fatos:
        context = bloco_fatos + "\n\n---\n\n" + context
    if bloco_historico:
        context = bloco_historico + "\n\n---\n\n" + context
    if bloco_schema:
        context = (
            bloco_schema
            + "\n\n---\n\n[Contexto de arquivos locais em backend/contextos/]\n\n"
            + context
            + "\n\n"
            + SCHEMA_INSTR_SQL
        )
    if quer_pg:
        context = (
            "[FOCO SELECT / SQL]\n\n"
            + SQL_SELECT_FOCUS
            + "\n\n---\n\n"
            + context
        )

    prefixo_parts: list[str] = []
    if bloco_empresa:
        prefixo_parts.append(bloco_empresa)
    if bloco_fatos:
        prefixo_parts.append(bloco_fatos)
    prefixo = "\n\n---\n\n".join(prefixo_parts) + ("\n\n" if prefixo_parts else "")
    post_breve_block = f"{PEDIDOS_POST_BREVE}\n\n" if pergunta_sobre_post_redes(q) else ""
    prompt_text = prefixo + PROMPT_RAG.format(
        context=context, question=q, post_breve_block=post_breve_block
    )
    msg = modelo.invoke(prompt_text)
    text = msg.content if hasattr(msg, "content") else str(msg)
    if pergunta_sobre_post_redes(q):
        text = _truncar_resposta_pedido_post(text)
    return {"result": text, "source_documents": docs}
