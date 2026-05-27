"""Espelha ``backend/src/services/tumaInterpretation.js`` (intenção de post/arte)."""

from __future__ import annotations

import re

_VISUAL_TOPIC = re.compile(
    r"instagram|insta\b|reels?\b|stories|feed\b|legenda|hashtag|#\w|arte\b|banner|flyer|"
    r"card[aá]pio|campanha|divulga(c|ç)(a|ã)o|m[ií]dia\s*social|pr[eé][- ]?via|visual\b|"
    r"design\b|ilustra(c|ç)[aã]o|foto(grafia)?\b|png\b|quadrado\b|1080",
    re.IGNORECASE,
)
_POST_WITH_ACTION = re.compile(
    r"\b(post(agem|ar)?)\b.{0,24}\b(fazer|criar|montar|gerar|publicar)\b|"
    r"\b(fazer|criar|montar|gerar|publicar)\b.{0,24}\b(post(agem|ar)?)\b",
    re.IGNORECASE,
)
_PEDIDO_META = re.compile(
    r"\bfazer\s+um\s+pedido\b|\bpedido\s+de\s+(um|uma)\s+post(agem)?\b",
    re.IGNORECASE,
)
_EXPLICIT_CREATE = re.compile(
    r"\b(quero|preciso|vamos|bora)\s+(de\s+)?(fazer|criar|montar|gerar|publicar)\s+(um|uma|minha|meu)?\s*"
    r"(arte|imagem|post(agem)?|banner|flyer|pr[eé]via|visual)\b|"
    r"\b(quero|preciso)\s+(um|uma|minha|meu)\s+(arte|imagem|post(agem)?|banner|flyer|pr[eé]via|visual)\b|"
    r"\b(gera|gerar|monta|montar|cria|criar|faz|faça|manda|mandar)\s+(um|uma|a|o|minha|meu|pra|para)?\s*"
    r"(arte|imagem|post(agem)?|banner|flyer|pr[eé]via|visual)\b|"
    r"\bfazer\s+(um|uma)\s+(arte|imagem|post(agem)?|banner|flyer)\b|"
    r"\bme\s+ajuda\s+a\s+(fazer|criar|montar|gerar|publicar)\s+(um|uma)?\s*(arte|imagem|post(agem)?|banner)?\b|"
    r"\bcri(e|ar)\s+(um|uma)\s+(arte|imagem|post(agem)?|visual)\b|"
    r"\bmont(a|ar)\s+(um|uma|a)\s+(arte|imagem|post(agem)?|banner)\b",
    re.IGNORECASE,
)
_META_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"\bse\s+eu\s+(fizer|pedir|quiser|for|puder|montar|criar|fazer|solicitar)\b",
        r"\b(se|caso)\s+eu\b",
        r"\b(dá|da)\s+pra\s+(fazer|pedir|montar|criar|gerar)\b",
        r"\bposso\s+pedir\b",
        r"\bcomo\s+(eu\s+)?(faço|faco|pedir|solicito|funciona)\b",
        r"\b(você|voce|vc)\s+me\s+ajuda\s*\?\s*$",
        r"\bconsegue\s+me\s+ajudar\b",
    )
]


def eh_pergunta_meta_ou_hipotetica(texto: str) -> bool:
    q = (texto or "").strip()
    if not q:
        return False
    if any(p.search(q) for p in _META_PATTERNS):
        if _EXPLICIT_CREATE.search(q) and re.search(
            r"\b(quero|preciso|gera|monta|cria|faz|me\s+ajuda\s+a)\b", q, re.IGNORECASE
        ):
            return False
        return True
    if re.search(r"\b(você|voce|vc)\s+(me\s+)?ajuda\s*\?", q, re.IGNORECASE) and not re.search(
        r"\bme\s+ajuda\s+a\s+(fazer|criar|montar|gerar)\b", q, re.IGNORECASE
    ):
        return True
    return False


def tem_pedido_explicito_de_criar(texto: str) -> bool:
    q = (texto or "").strip()
    if not q:
        return False
    if _PEDIDO_META.search(q):
        return False
    if _EXPLICIT_CREATE.search(q):
        return True
    return bool(
        _POST_WITH_ACTION.search(q)
        and re.search(r"\b(quero|preciso|agora|hoje|bora|vamos)\b", q, re.IGNORECASE)
    )


def pergunta_pedido_real_post_redes(pergunta: str) -> bool:
    """True só para pedido de execução (não dúvida com palavra postagem)."""
    q = (pergunta or "").strip()
    if len(q) < 10:
        return False
    if eh_pergunta_meta_ou_hipotetica(q):
        return False
    if tem_pedido_explicito_de_criar(q):
        return True
    if _VISUAL_TOPIC.search(q) or _POST_WITH_ACTION.search(q):
        return bool(
            re.search(r"\b(quero|preciso|vamos|bora|agora|hoje|monta|gera|cria|faz)\b", q, re.IGNORECASE)
        )
    return False
