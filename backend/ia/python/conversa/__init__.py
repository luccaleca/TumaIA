"""
Pacote da conversa: RAG, provedores de modelo, identidade e instruções.

Pastas em pt-BR: ``instrucoes/`` (textos ao modelo), módulos com nomes em português.
"""

from .indice_vetorial import construir_vetor_store, criar_ou_carregar_indice
from .orquestrador import responder_mensagem


def construir_chain_rag():
    """
    Compatibilidade com código antigo: retorna só o vetor store.
    Prefira ``construir_vetor_store()``.
    """
    return construir_vetor_store()


__all__ = [
    "construir_chain_rag",
    "construir_vetor_store",
    "criar_ou_carregar_indice",
    "responder_mensagem",
]
