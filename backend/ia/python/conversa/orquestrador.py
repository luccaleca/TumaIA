"""Montagem do prompt e resposta principal (RAG + schema + histórico)."""

import re
from concurrent.futures import ThreadPoolExecutor

from langchain_chroma import Chroma

try:
    from .. import schema_supabase
except ImportError:
    import schema_supabase

from .historico import formatar_historico_prompt, normalizar_historico
from .identidade import (
    bloco_fatos_identidade_para_prompt,
    bloco_fatos_identidade_resposta,
    bloco_foco_pergunta_atual,
    instrucao_continuidade_conversa,
    remover_saudacao_repetida,
    resposta_cordial_curta,
    resposta_criador_curta,
    resposta_followup_nome,
    sanitizar_resposta_perfil_identidade,
    usuario_pergunta_sobre_criador,
)
from .instrucoes import (
    PROMPT_RAG,
    REGRAS_TUMA_IA,
    REGRAS_INTERPRETACAO_TUMA,
    PAPEL_FUNCIONARIO_EMPRESA,
    SCHEMA_INSTR_SQL,
    ESTILO_CONVERSA,
    PEDIDOS_POST_BREVE,
    SEM_META_RESPOSTA,
    SQL_SELECT_FOCUS,
)

_IDENTIDADE_TUMA_PROMPT = (
    "Você é o Tuma IA: assistente de criação de artes e posts para Instagram da empresa "
    "no bloco cadastral abaixo. Fale como funcionário de marketing (use o nome fantasia). "
    "Amigável, português do Brasil.\n"
)
from .pedidos_post import pergunta_sobre_post_redes
from .provedores import llm_conversa_aberta, llm_para_contexto
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


_BLOCO_CONVERSA_ABERTA = (
    "[Conversa natural — o usuário perguntou algo fora de posts/acervo]\n"
    "- PRIMEIRO: responda o que foi perguntado (receita, dica, curiosidade) em 2–4 frases úteis.\n"
    "- PROIBIDO: «não entendi», «não captei», «isso foge do escopo», ignorar a pergunta.\n"
    "- NÃO liste produtos, mídias, PNGs nem o acervo (salvo se pedirem).\n"
    "- NÃO repita saudação longa se já há histórico.\n"
    "- Exemplo: «como cozinhar batata» → explique cozimento/assar; não só marketing.\n"
    "- Depois, no máximo UMA frase opcional oferecendo ajuda com posts/artes da empresa.\n\n"
)


_BLOCO_PERFIL_IDENTIDADE = (
    "[Perfil: pergunta sobre o Tuma — quem é, para que serve, o que faz, como funciona o chat]\n"
    "- Leia a mensagem inteira e responda SÓ o que foi pedido.\n"
    "- 2–4 frases por tópico; se houver várias perguntas na mesma mensagem, responda em sequência.\n"
    "- Tom: colega do marketing da empresa (use o nome fantasia se souber).\n"
    "- NÃO monte listas genéricas de dicas de conteúdo, hashtags, «conheça seu público» ou campanha.\n"
    "- NÃO liste produtos, PNGs nem contagem do acervo — salvo se o usuário pedir explicitamente.\n"
    "- NÃO abra fluxo de gerar arte nem peça confirmação de post sem pedido claro.\n\n"
)


def _carregar_bloco_empresa(id_empresa: str | None) -> tuple[str | None, str]:
    """Retorna (nome_fantasia, bloco cadastral formatado)."""
    if not id_empresa:
        return None, ""
    empresa_row, emp_err = schema_supabase.obter_empresa_cadastro_por_id(str(id_empresa).strip())
    if empresa_row:
        bloco = schema_supabase.formatar_empresa_cadastro_prompt(empresa_row)
        nf = str(empresa_row.get("nome_fantasia") or "").strip()
        return nf or None, bloco
    if emp_err:
        return None, "[AVISO: não foi possível carregar o cadastro da empresa em sessão]\n" + emp_err
    return None, ""


_RE_PERGUNTA_DATA = re.compile(
    r"\b("
    r"que\s+dia\s+(?:é|e)\s+hoje|"
    r"qual\s+(?:é|e)\s+a\s+data|"
    r"data\s+de\s+hoje|"
    r"que\s+horas?\s+s[aã]o|"
    r"hoje\s+é\s+que\s+dia|"
    r"dia\s+da\s+semana|"
    r"m[eê]s\s+e\s+ano|"
    r"quero\s+(?:o\s+)?dia|"
    r"me\s+(?:diz|diga|fala)\s+a\s+data"
    r")\b",
    re.IGNORECASE,
)


def _pergunta_pediu_data_hora(pergunta: str) -> bool:
    return bool(_RE_PERGUNTA_DATA.search(pergunta))


def _responder_identidade_rapida(
    pergunta: str,
    historico: list[dict[str, str]],
    id_empresa: str | None = None,
) -> dict:
    """Perfil identidade: prompt curto, sem RAG nem acervo."""
    if usuario_pergunta_sobre_criador(pergunta):
        return {"result": resposta_criador_curta(), "source_documents": []}

    modelo = llm_conversa_aberta()
    nome_fantasia, _ = _carregar_bloco_empresa(id_empresa)
    bloco_hist = formatar_historico_prompt(historico[-6:])
    bloco_cont = instrucao_continuidade_conversa(historico)
    bloco_fatos = bloco_fatos_identidade_resposta(nome_fantasia)
    bloco_foco = bloco_foco_pergunta_atual(pergunta)
    bloco_empresa_curto = f"[Empresa em sessão: {nome_fantasia}]\n\n" if nome_fantasia else ""
    prompt = (
        "Você é o Tuma IA. Português do Brasil, humano e direto.\n\n"
        f"{bloco_cont}"
        f"{bloco_foco}"
        f"{_BLOCO_PERFIL_IDENTIDADE}"
        f"{bloco_fatos}\n"
        f"{bloco_empresa_curto}"
        f"{bloco_hist}\n\n" if bloco_hist else ""
        f"Usuário: {pergunta.strip()}\n"
    )
    msg = modelo.invoke(prompt)
    text = msg.content if hasattr(msg, "content") else str(msg)
    text = remover_saudacao_repetida(text, historico)
    text = sanitizar_resposta_perfil_identidade(pergunta, text)
    return {"result": text, "source_documents": []}


def _agora_brasilia():
    from datetime import datetime
    from zoneinfo import ZoneInfo

    return datetime.now(ZoneInfo("America/Sao_Paulo"))


def _formatar_data_hora_usuario(pergunta: str) -> str:
    """Resposta curta com data real — sem inventar dia da semana nem pitch de marketing."""
    try:
        agora = _agora_brasilia()
        meses = (
            "janeiro", "fevereiro", "março", "abril", "maio", "junho",
            "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
        )
        dias = (
            "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira",
            "sexta-feira", "sábado", "domingo",
        )
        mes = meses[agora.month - 1]
        dia_sem = dias[agora.weekday()]
        if re.search(r"\bhoras?\b", pergunta, re.I) and not re.search(
            r"\b(dia|data|semana|m[eê]s)\b", pergunta, re.I
        ):
            return (
                f"Agora são {agora.strftime('%H:%M')} em Brasília "
                f"({dia_sem}, {agora.day} de {mes} de {agora.year})."
            )
        return f"Hoje é {dia_sem}, {agora.day} de {mes} de {agora.year} (horário de Brasília, {agora.strftime('%H:%M')})."
    except Exception:
        return "Não consegui ler a data do servidor agora — tente de novo em instantes."


def _bloco_data_hora_brasilia() -> str:
    try:
        agora = _agora_brasilia()
        meses = (
            "janeiro", "fevereiro", "março", "abril", "maio", "junho",
            "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
        )
        mes = meses[agora.month - 1]
        return (
            f"[Relógio do servidor — Brasília: {agora.day} de {mes} de {agora.year}, "
            f"{agora.strftime('%H:%M')}. Use isso se perguntarem «hoje», data ou dia do mês — "
            "não invente dia da semana nem mês; não peça a data ao usuário.]\n\n"
        )
    except Exception:
        return ""


def _responder_conversa_aberta_rapida(pergunta: str, historico: list[dict[str, str]]) -> dict:
    """Caminho leve: sem Postgres, RAG nem blocos longos de regras."""
    modelo = llm_conversa_aberta()
    bloco_hist = formatar_historico_prompt(historico[-6:])
    bloco_cont = instrucao_continuidade_conversa(historico)
    bloco_data = _bloco_data_hora_brasilia() if _pergunta_pediu_data_hora(pergunta) else ""
    prompt = (
        "Você é o Tuma IA (marketing / posts / artes). Português do Brasil, tom de colega.\n\n"
        f"{bloco_data}"
        f"{bloco_cont}"
        f"{_BLOCO_CONVERSA_ABERTA}"
        f"{bloco_hist}\n\n" if bloco_hist else ""
        f"Usuário: {pergunta.strip()}\n"
    )
    msg = modelo.invoke(prompt)
    text = msg.content if hasattr(msg, "content") else str(msg)
    text = remover_saudacao_repetida(text, historico)
    text = sanitizar_resposta_perfil_identidade(pergunta, text)
    return {"result": text, "source_documents": []}


def responder_mensagem(
    vetor_store: Chroma,
    pergunta: str,
    history: list[dict] | None = None,
    id_empresa: str | None = None,
    acervo_context: str | None = None,
    chat_mode: str | None = None,
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

    if _pergunta_pediu_data_hora(q):
        return {"result": _formatar_data_hora_usuario(q), "source_documents": []}

    if chat_mode == "conversa_aberta":
        return _responder_conversa_aberta_rapida(q, historico)

    if chat_mode == "identidade":
        return _responder_identidade_rapida(q, historico, id_empresa)

    nome_fantasia, bloco_empresa = _carregar_bloco_empresa(id_empresa)

    rid = resposta_cordial_curta(q, nome_fantasia)
    if rid:
        return {"result": rid, "source_documents": []}

    resposta_follow = resposta_followup_nome(q, historico)
    if resposta_follow:
        return {"result": resposta_follow, "source_documents": []}

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
    bloco_continuidade = instrucao_continuidade_conversa(historico)
    bloco_post_breve = f"{PEDIDOS_POST_BREVE}\n\n" if pergunta_sobre_post_redes(q) else ""
    bloco_acervo = ""
    if acervo_context and str(acervo_context).strip():
        bloco_acervo = str(acervo_context).strip() + "\n\n"

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
                + f"{PAPEL_FUNCIONARIO_EMPRESA}\n\n"
                + f"{REGRAS_TUMA_IA}\n\n"
                + f"{REGRAS_INTERPRETACAO_TUMA}\n\n"
                + bloco_continuidade
                + bloco_post_breve
                + (f"{bloco_empresa}\n\n" if bloco_empresa else "")
                + bloco_acervo
                + (f"{bloco_fatos}\n" if bloco_fatos else "")
                + f"{SQL_SELECT_FOCUS}\n\n"
                + f"{SCHEMA_INSTR_SQL}\n\n"
                + (f"{bloco_historico}\n\n" if bloco_historico else "")
                + f"{bloco_schema}\n\n"
                + "Responda à mensagem do usuário de forma natural. "
                + "Não diga que consultou 'information_schema' nem cite nomes internos de ferramenta.\n\n"
                + f"Usuário: {q}"
            )
            text = msg.content if hasattr(msg, "content") else str(msg)
            text = remover_saudacao_repetida(text, historico)
            if pergunta_sobre_post_redes(q):
                text = _truncar_resposta_pedido_post(text)
            return {"result": text, "source_documents": []}
        else:
            msg = modelo.invoke(
                _IDENTIDADE_TUMA_PROMPT
                + f"{SEM_META_RESPOSTA}\n"
                + f"{ESTILO_CONVERSA}\n"
                + f"{PAPEL_FUNCIONARIO_EMPRESA}\n\n"
                + f"{REGRAS_TUMA_IA}\n\n"
                + f"{REGRAS_INTERPRETACAO_TUMA}\n\n"
                + bloco_continuidade
                + bloco_post_breve
                + (f"{bloco_empresa}\n\n" if bloco_empresa else "")
                + bloco_acervo
                + (f"{bloco_fatos}\n" if bloco_fatos else "")
                + (f"{bloco_historico}\n" if bloco_historico else "")
                + "Responda à mensagem do usuário de forma natural. "
                + "Não cite documentos internos nem fontes (não há trecho aplicável da base agora).\n\n"
                + f"Usuário: {q}"
            )
        text = msg.content if hasattr(msg, "content") else str(msg)
        text = remover_saudacao_repetida(text, historico)
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
    if bloco_acervo:
        prefixo_parts.append(bloco_acervo.strip())
    if bloco_fatos:
        prefixo_parts.append(bloco_fatos)
    prefixo = "\n\n---\n\n".join(prefixo_parts) + ("\n\n" if prefixo_parts else "")
    post_breve_block = f"{PEDIDOS_POST_BREVE}\n\n" if pergunta_sobre_post_redes(q) else ""
    prompt_text = prefixo + PROMPT_RAG.format(
        context=context, question=q, post_breve_block=post_breve_block
    )
    msg = modelo.invoke(prompt_text)
    text = msg.content if hasattr(msg, "content") else str(msg)
    text = remover_saudacao_repetida(text, historico)
    if pergunta_sobre_post_redes(q):
        text = _truncar_resposta_pedido_post(text)
    return {"result": text, "source_documents": docs}
