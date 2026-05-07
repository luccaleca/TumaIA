"""Atalhos e regras de identidade do assistente (nome, criador, follow-ups)."""

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
    r"\b(nome|quem (é|e) (voc[eê]|tu)|quem te criou|criador|origem do nome|significa|motivo|raz[aã]o|tuma)\b",
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
            r"\b(criador|quem\s+te\s+criou|quem\s+te\s+fez|diego)\b",
            p,
            re.IGNORECASE,
        )
    )


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


def resposta_identidade(pergunta: str) -> str | None:
    p = pergunta.lower()
    if RE_MENSAGEM_CURTA_CASUAL.match(pergunta):
        return "E aí! Pode falar."

    if not RE_IDENTIDADE.search(p):
        return None

    if pergunta_motivo_origem_significado_do_nome(pergunta):
        base = (
            "Sou o assistente Tuma. O nome vem do suaíli (swahili): "
            "'tuma' significa 'enviar'."
        )
        if usuario_pergunta_sobre_criador(pergunta):
            return base + " Fui criado por Diego Suhai Navarro."
        return base

    pergunta_criador = any(k in p for k in ["criador", "quem te criou"])
    pergunta_nome = any(
        k in p for k in ["seu nome", "qual seu nome", "como você se chama", "como voce se chama"]
    )
    pergunta_significado = any(
        k in p
        for k in [
            "origem do nome",
            "significa",
            "o que significa",
            "que significa",
            "história do nome",
            "historia do nome",
        ]
    )

    if pergunta_criador and not (pergunta_nome or pergunta_significado):
        return "Fui criado por Diego Suhai Navarro."

    if pergunta_nome and not (pergunta_criador or pergunta_significado):
        return "Meu nome é Tuma."

    if pergunta_significado and not (pergunta_criador or pergunta_nome):
        return "O nome 'Tuma' vem do suaíli (Swahili) e significa 'enviar'."

    if pergunta_criador or pergunta_nome or pergunta_significado:
        partes = []
        if pergunta_nome:
            partes.append("Meu nome é Tuma.")
        if pergunta_criador:
            partes.append("Fui criado por Diego Suhai Navarro.")
        if pergunta_significado:
            partes.append("O nome 'Tuma' vem do suaíli (Swahili) e significa 'enviar'.")
        return " ".join(partes)

    if "quem é você" in p or "quem e voce" in p:
        return "Sou o Tuma, assistente do TumaCore."

    return None


def resposta_cordial_curta(pergunta: str) -> str | None:
    """
    Evita acionar fluxos técnicos em mensagens de cortesia/encerramento.
    """
    if RE_AGRADECIMENTO_OU_ENCERRAMENTO.match(pergunta):
        return "Perfeito! Quando quiser, pode mandar a próxima."
    return None
