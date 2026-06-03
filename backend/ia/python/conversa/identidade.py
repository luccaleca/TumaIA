import re

# Pergunta parece sobre dados / sistema Tuma ou SAP (força uso dos trechos recuperados).
RE_TECNICO = re.compile(
    r"\b("
    r"sap|tuma|erp|vbrk|tabela|módulo|modulo|transa[cç][aã]o|bapi|idoc|"
    r"relat[oó]rio|consulta|faturamento|nota[\s-]?fiscal|pedido[\s-]?venda|"
    r"cadastro|campo|documento|mestre"
    r")\b",
    re.IGNORECASE,
)

RE_IDENTIDADE = re.compile(
    r"\b("
    r"qual\s+seu\s+nome|seu\s+nome|como\s+(?:você|voce|vc)\s+se\s+chama|"
    r"quem\s+(é|e)\s+(voc[eê]|voce|vc|tu)|"
    r"o\s+que\s+(você|voce|vc)\s+faz|"
    r"quem\s+te\s+criou|criador|origem\s+do\s+nome|significa\s+tuma|significado\s+do\s+nome|motivo|raz[aã]o|\btuma\b"
    r")\b",
    re.IGNORECASE,
)
RE_MENSAGEM_CURTA_CASUAL = re.compile(
    r"^\s*(oi+|ol[aá]|e\s*a[ií]|fala(?:\s+a[ií])?|opa+|blz|beleza|suave|tudo\s+bem\??)\s*[!.?]*\s*$",
    re.IGNORECASE,
)
RE_AGRADECIMENTO_OU_ENCERRAMENTO = re.compile(
    r"^\s*("
    r"obrigad[oa](\s+mesmo)?|"
    r"valeu+(\s+mesmo)?|"
    r"show+|"
    r"perfeito+|"
    r"fechou+|"
    r"blz+|"
    r"beleza+|"
    r"top+|"
    r"isso\s+(ajudou|resolveu)|"
    r"era\s+isso|"
    r"tchau+|"
    r"até\s+mais|"
    r"falou+"
    r")\s*[!.?]*\s*$",
    re.IGNORECASE,
)

# Motivo / origem / significado — antes de confundir com "qual é seu nome".
RE_MOTIVO_ORIGEM_NOME = re.compile(
    r"("
    r"por\s*qu[eê]|porque|porquê|motivo|raz[aã]o|"
    r"origem(\s+do\s+nome)?|significado|"
    r"\bsignifica\b|o\s+que\s+significa|que\s+significa|"
    r"de\s+onde\s+(vem|veio)|hist[oó]ria\s+do\s+nome|"
    r"\bexplic\w*|quer\s+dizer"
    r")",
    re.IGNORECASE,
)
RE_GATILHO_NOME_TUMA = re.compile(
    r"\b(nome|tuma|chama(m)?|apelido)\b",
    re.IGNORECASE,
)


def pergunta_motivo_origem_significado_do_nome(pergunta: str) -> bool:
    """Pergunta *por que* / origem / significado do nome — não só 'qual é seu nome'."""
    p = pergunta.lower()
    if RE_MOTIVO_ORIGEM_NOME.search(p) and RE_GATILHO_NOME_TUMA.search(p):
        return True
    if RE_MOTIVO_ORIGEM_NOME.search(p) and re.search(
        r"\b(seu|teu|do\s+nome|esse\s+nome|esse\s+apelido)\b", p, re.IGNORECASE
    ):
        return True
    return False


def pergunta_significado_do_nome_tuma(pergunta: str) -> bool:
    """True só quando a frase pergunta origem/significado do **nome Tuma** — não siglas gerais."""
    p = pergunta.lower()
    if re.search(r"significa\s+tuma|origem\s+do\s+nome|significado\s+do\s+nome", p, re.I):
        return True
    if re.search(r"\bsignifica\b", p) and re.search(r"\b(nome|apelido)\b", p):
        if re.search(r"\b(tuma|tuma\s*ia)\b", p, re.I):
            return True
        if re.search(r"\b(seu|teu|do\s+nome|esse\s+nome)\b", p, re.I):
            return True
    return False


RE_ASSISTENTE_DISSE_NOME_TUMA = re.compile(
    r"(meu\s+nome\s+é\s+tuma|me\s+chamo\s+tuma|sou\s+(o\s+)?tuma)",
    re.IGNORECASE,
)


def historico_sobre_nome_tuma(historico: list[dict[str, str]]) -> bool:
    """True se a conversa recente já falou do nome / Tuma."""
    if not historico:
        return False
    blob = " ".join(t["content"] for t in historico[-6:])
    if RE_ASSISTENTE_DISSE_NOME_TUMA.search(blob):
        return True
    if re.search(r"\b(nome|tuma|apelido)\b", blob, re.IGNORECASE):
        return True
    return False


RE_FOLLOWUP_AMBIGUO = re.compile(
    r"^\s*(por\s*qu[eê]\??|porque\??|por\s+qu[eê]|qual\s+o\s+motivo\??|motivo\??)\s*$",
    re.IGNORECASE,
)


def resposta_followup_nome(pergunta: str, historico: list[dict[str, str]]) -> str | None:
    """
    Respostas curtas quando o usuário manda só 'por quê?' depois de perguntar o nome,
    etc. Depende do histórico enviado pelo front.
    """
    q = pergunta.strip()
    if not historico or not historico_sobre_nome_tuma(historico):
        return None
    if not RE_FOLLOWUP_AMBIGUO.match(q):
        return None
    return "Porque 'Tuma' vem do suaíli (swahili) e significa 'enviar'."


def usuario_pergunta_sobre_criador(q: str) -> bool:
    p = q.lower()
    return bool(
        re.search(
            r"\b("
            r"criador|"
            r"quem\s+te\s+criou|"
            r"quem\s+te\s+fez|"
            r"quem\s+foi\s+(?:seu|o)\s+criador|"
            r"quem\s+foi\s+que\s+te\s+criou|"
            r"quem\s+desenvolveu|"
            r"por\s+quem\s+(?:você|voce|vc|te)\s+(?:foi\s+)?criad|"
            r"(?:você|voce|vc)\s+foi\s+criad|"
            r"foi\s+criad[oa]\s+por|"
            r"vc\s+foi\s+criado\s+por\s+quem"
            r")\b",
            p,
            re.IGNORECASE,
        )
    )


def usuario_pergunta_origem_nascimento(q: str) -> bool:
    """Pai/mãe/nasceu/de onde veio — metáforas de origem, não produto."""
    p = q.lower()
    return bool(
        re.search(
            r"\b("
            r"pai|m[aã]e|mae|pais|"
            r"nasceu|nascer|nascimento|"
            r"de\s+onde\s+(?:você|voce|vc)\s+(?:veio|vem|é|e)|"
            r"(?:sua|teu|seu)\s+origem|"
            r"(?:você|voce|vc)\s+veio\s+de\s+onde"
            r")\b",
            p,
            re.IGNORECASE,
        )
    )


def resposta_origem_nascimento(pergunta: str, nome_fantasia: str | None = None) -> str:
    p = pergunta.lower()
    empresa = _rotulo_empresa(nome_fantasia)
    if re.search(r"\b(m[aã]e|mae)\b", p) and not re.search(r"\bpai\b", p):
        return "Não tenho mãe no sentido humano — sou o Tuma IA, software criado por Diego Suhai Navarro."
    if re.search(r"\b(pai|pais)\b", p):
        return (
            "Não tenho pai no sentido humano — sou o Tuma IA, software de marketing "
            "criado por Diego Suhai Navarro."
        )
    destino = f" para ajudar a {empresa} com posts e artes" if empresa else " para ajudar empresas com posts e artes no painel"
    return (
        f"No sentido de projeto, «nascer» foi no TumaIA: fui criado por Diego Suhai Navarro{destino}."
    )


def resposta_criador_curta() -> str:
    return "Fui criado por Diego Suhai Navarro."


RE_ECO_RESPOSTA_DATA = re.compile(
    r"^\s*Hoje\s+é\s+\w+",
    re.IGNORECASE,
)


def sanitizar_resposta_perfil_identidade(pergunta: str, texto: str) -> str:
    """
    Corrige eco do modelo (ex.: repetir data do histórico quando perguntaram o criador).
    """
    t = (texto or "").strip()
    if not t:
        return texto

    if usuario_pergunta_sobre_criador(pergunta):
        if RE_ECO_RESPOSTA_DATA.match(t) or (
            "posts ou artes" in t.lower() and "diego" not in t.lower()
        ):
            return resposta_criador_curta()

    return texto


def bloco_foco_pergunta_atual(pergunta: str) -> str:
    """Instrução explícita sobre o pedido da mensagem atual."""
    if usuario_pergunta_sobre_criador(pergunta):
        return (
            "[Pergunta atual — obrigatório]\n"
            "O usuário quer saber QUEM TE CRIOU. "
            "Responda em 1–2 frases: Diego Suhai Navarro. "
            "NÃO repita a data de hoje nem a resposta anterior.\n\n"
        )
    if usuario_pergunta_origem_nascimento(pergunta):
        return (
            "[Pergunta atual — obrigatório]\n"
            "Pergunta sobre pai/mãe/nascer/origem. "
            "Explique: sem pai/mãe humanos; projeto TumaIA; criador Diego Suhai Navarro. "
            "NÃO liste produtos.\n\n"
        )
    if re.search(r"\b(?:pra|para)\s+(?:que|o\s?q|oq)\b", pergunta, re.I) and re.search(
        r"\bserve\b", pergunta, re.I
    ):
        return (
            "[Pergunta atual — obrigatório]\n"
            "Explique para que o Tuma IA serve (posts/artes Instagram da empresa). "
            "NÃO liste dicas genéricas de marketing.\n\n"
        )
    return ""


RE_SAUDACAO_REPETIDA_INICIO = re.compile(
    r"^(?:Oi!?\s*)?"
    r"(?:Sou o Tuma IA[^.\n!?]*[.!?]\s*)+"
    r"(?:como posso te ajudar hoje\?\s*)?",
    re.IGNORECASE,
)


def instrucao_continuidade_conversa(historico: list[dict[str, str]]) -> str:
    """Evita reapresentação no meio do chat."""
    if not historico:
        return ""
    return (
        "[Conversa em andamento — obrigatório]\n"
        "- NÃO cumprimente de novo nem repita «Oi! Sou o Tuma IA, como posso te ajudar hoje?».\n"
        "- NÃO se apresente de novo se o usuário não perguntou quem você é.\n"
        "- NÃO repita a resposta anterior (ex.: data/hora) se o pedido atual for outro assunto.\n"
        "- Responda só o pedido atual, direto e curto.\n\n"
    )


def remover_saudacao_repetida(texto: str, historico: list[dict[str, str]]) -> str:
    if not historico:
        return texto
    t = (texto or "").strip()
    for _ in range(3):
        m = RE_SAUDACAO_REPETIDA_INICIO.match(t)
        if not m or m.end() < 12:
            break
        t = t[m.end() :].lstrip()
    return t.strip() or texto


def bloco_fatos_identidade_resposta(nome_fantasia: str | None = None) -> str:
    """Fatos mínimos para perfil identidade — sempre injetados, sem RAG."""
    linhas = [
        "[Fatos do assistente — use só o que a pergunta pedir]",
        "- Nome: Tuma IA",
        "- Papel: assistente de posts e artes para Instagram da empresa em sessão",
        "- Fluxo: usuário pede arte → painel mostra resumo → confirma → prévia",
        "- Origem do nome: «tuma» em suaíli (swahili) significa «enviar» — só se perguntarem do nome",
        "- Criador: Diego Suhai Navarro — só se perguntarem quem te criou",
    ]
    if nome_fantasia:
        linhas.append(f"- Empresa ativa agora: {nome_fantasia}")
    return "\n".join(linhas) + "\n"


def bloco_fatos_identidade_para_prompt(historico: list[dict[str, str]], q: str) -> str:
    """
    Injeta fatos mínimos de identidade só quando a conversa claramente é sobre nome/Tuma,
    para o modelo não 'não saber' sem soar meta (instruções internas).
    """
    if not historico and not RE_IDENTIDADE.search(q):
        return ""
    if not (
        historico_sobre_nome_tuma(historico)
        or RE_IDENTIDADE.search(q)
        or pergunta_motivo_origem_significado_do_nome(q)
    ):
        return ""
    linhas = [
        "[Fatos fixos do assistente — use só o que for pedido; não liste como regras]",
        "- Nome: Tuma",
        "- Papel: IA de conteúdo do TumaIA — posts e artes para Instagram da empresa em sessão (marketing interno)",
        "- Origem do nome: 'tuma' em suaíli (swahili) significa 'enviar'",
    ]
    if usuario_pergunta_sobre_criador(q):
        linhas.append("- Criador: Diego Suhai Navarro")
    return "\n".join(linhas) + "\n"


def pergunta_indica_dados_tuma(pergunta: str) -> bool:
    if RE_TECNICO.search(pergunta):
        return True
    t = pergunta.lower()
    if "nota fiscal" in t or "nota-fiscal" in t:
        return True
    # Códigos estilo tabela SAP (ex.: VBRK, MARA)
    if re.search(r"\b[A-Z]{4,}\d*\b", pergunta):
        return True
    return False


def _rotulo_empresa(nome_fantasia: str | None) -> str:
    n = (nome_fantasia or "").strip()
    return n


def resposta_identidade(pergunta: str, nome_fantasia: str | None = None) -> str | None:
    p = pergunta.lower()
    empresa = _rotulo_empresa(nome_fantasia)

    if RE_MENSAGEM_CURTA_CASUAL.match(pergunta):
        if empresa:
            return (
                f"Oi! Sou o Tuma IA, assistente de criação de artes da {empresa}. "
                "O que você precisa hoje?"
            )
        return "Oi! Sou o Tuma IA. O que você precisa hoje?"

    if usuario_pergunta_origem_nascimento(pergunta):
        return resposta_origem_nascimento(pergunta, nome_fantasia)

    if usuario_pergunta_sobre_criador(pergunta):
        return resposta_criador_curta()

    if not RE_IDENTIDADE.search(p):
        return None

    if re.search(r"quem\s+(é|e)\s+(você|voce|vc|tu)\b", p, re.IGNORECASE):
        if empresa:
            return (
                f"Sou o Tuma IA, seu assistente de criação de artes para a {empresa}. "
                "Ajudo com posts e conteúdo pro Instagram — no dia a dia falo como alguém do marketing de vocês."
            )
        return (
            "Sou o Tuma IA, assistente de criação de artes e posts para Instagram. "
            "Trabalho com a empresa que você tem ativa no painel."
        )

    if pergunta_motivo_origem_significado_do_nome(pergunta):
        base = (
            "Sou o Tuma, IA de conteúdo do TumaIA. O nome vem do suaíli (swahili): "
            "'tuma' significa 'enviar'."
        )
        if usuario_pergunta_sobre_criador(pergunta):
            return base + " Fui criado por Diego Suhai Navarro."
        return base

    pergunta_criador = any(k in p for k in ["criador", "quem te criou"])
    pergunta_nome = any(
        k in p for k in ["seu nome", "qual seu nome", "como você se chama", "como voce se chama"]
    )
    pergunta_significado = pergunta_significado_do_nome_tuma(pergunta)

    if pergunta_criador and not (pergunta_nome or pergunta_significado):
        return "Fui criado por Diego Suhai Navarro."

    if re.search(r"o\s+que\s+(você|voce|vc)\s+faz", p):
        if empresa:
            return (
                f"Ajudo a {empresa} com ideias, posts e artes para Instagram, usando as fotos de produto "
                "cadastradas em Mídias. Quando você pedir uma arte, o painel mostra o resumo antes da prévia."
            )
        return (
            "Ajudo a montar posts e artes para Instagram com as mídias cadastradas no painel. "
            "Na hora de gerar, você confirma o resumo antes da prévia."
        )

    if pergunta_nome and not (pergunta_criador or pergunta_significado):
        if empresa:
            return f"Meu nome é Tuma IA — assistente de criação de artes da {empresa}."
        return "Meu nome é Tuma IA — assistente de criação de artes e posts para Instagram."

    if pergunta_significado and not (pergunta_criador or pergunta_nome):
        return "O nome 'Tuma' vem do suaíli (Swahili) e significa 'enviar'."

    if pergunta_criador or pergunta_nome or pergunta_significado:
        partes = []
        if pergunta_nome:
            partes.append("Meu nome é Tuma — IA de conteúdo do TumaIA.")
        if pergunta_criador:
            partes.append("Fui criado por Diego Suhai Navarro.")
        if pergunta_significado:
            partes.append("O nome 'Tuma' vem do suaíli (Swahili) e significa 'enviar'.")
        return " ".join(partes)

    return None


def resposta_cordial_curta(pergunta: str, nome_fantasia: str | None = None) -> str | None:
    """
    Evita acionar fluxos técnicos em mensagens de cortesia/encerramento.
    """
    if RE_AGRADECIMENTO_OU_ENCERRAMENTO.match(pergunta):
        empresa = _rotulo_empresa(nome_fantasia)
        if empresa:
            return f"Perfeito! Quando a {empresa} precisar de algo, é só chamar."
        return "Perfeito! Quando quiser, pode mandar a próxima."
    return None
