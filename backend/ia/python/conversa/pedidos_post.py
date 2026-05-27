"""Detecta pedidos reais de post/rede social (não dúvida hipotética com palavra postagem)."""

from __future__ import annotations

from .interpretacao import pergunta_pedido_real_post_redes


def pergunta_sobre_post_redes(pergunta: str) -> bool:
    return pergunta_pedido_real_post_redes(pergunta)
