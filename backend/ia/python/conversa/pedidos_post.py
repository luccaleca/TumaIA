"""Detecta pedidos de post/rede social (espelha ``chatDeliveryUi.js`` no Node)."""

from __future__ import annotations

import re

_DELIVERY_HINT = re.compile(
    r"post(agem|ar|s)?|instagram|insta\b|reels?\b|stories|feed\b|legenda|hashtag|#\w|"
    r"arte\b|banner|flyer|card[aá]pio|campanha|divulga(c|ç)(a|ã)o|m[ií]dia\s*social|"
    r"pr[eé][- ]?via|crie\s+(uma?\s+)?(arte|imagem|post)|convite|dia\s+dos|"
    r"black\s*friday|natal|p[aá]scoa|seguidores?|500\s*k|\bmarco\b|alcance",
    re.IGNORECASE,
)


def pergunta_sobre_post_redes(pergunta: str) -> bool:
    q = (pergunta or "").strip()
    if len(q) < 10:
        return False
    return bool(_DELIVERY_HINT.search(q))
