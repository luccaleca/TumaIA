"""Constantes e carregamento de ambiente para LLM/embeddings."""

import os
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

# Relevância mínima do melhor trecho para usar contexto sem palavras-chave técnicas.
# Ajuste com TUMACORE_MIN_RELEVANCE no .env (ex.: 0.42).
MIN_RELEVANCIA_PADRAO = 0.42

# Alinhado a backend/src/ollamaDefaults.js (~4 GB VRAM).
DEFAULT_OLLAMA_CHAT_MODEL = "qwen2.5:3b"

# Quantos trechos no máximo mandar ao modelo quando há contexto (padrão 4).
# Reduza com TUMACORE_K_CONTEXTO=2 no .env para menos latência em troca de menos RAG.


def k_contexto() -> int:
    raw = (os.getenv("TUMACORE_K_CONTEXTO") or "").strip()
    if not raw:
        return 4
    try:
        return max(1, min(12, int(raw)))
    except ValueError:
        return 4


def min_relevancia() -> float:
    raw = os.getenv("TUMACORE_MIN_RELEVANCE", "").strip()
    if not raw:
        return MIN_RELEVANCIA_PADRAO
    try:
        return float(raw.replace(",", "."))
    except ValueError:
        return MIN_RELEVANCIA_PADRAO


def env_bool(nome: str, padrao: bool = False) -> bool:
    """Lê variável de ambiente como verdadeiro/falso (1, true, yes, on, sim)."""
    v = (os.getenv(nome) or "").strip().lower()
    if not v:
        return padrao
    return v in ("1", "true", "yes", "on", "sim")


def caminho_env(root_dir: Path) -> Path:
    env_config = root_dir / "config" / ".env"
    if env_config.is_file():
        return env_config
    env_local = root_dir / ".env"
    if env_local.is_file():
        return env_local
    # No TumaIA, o .env principal fica em backend/.env.
    env_backend = root_dir.parent / ".env"
    if env_backend.is_file():
        return env_backend
    return env_local


def garantir_ambiente_llm(root_dir: Path) -> None:
    """Carrega .env e valida que há chave suficiente para embeddings + chat."""
    env_path = caminho_env(root_dir)
    load_dotenv(dotenv_path=env_path, override=True, encoding="utf-8")

    env_file_values = dotenv_values(env_path) if env_path.is_file() else {}

    def _prioridade(chave: str) -> str:
        v = (env_file_values.get(chave) or "").strip()
        if v:
            return v
        return (os.getenv(chave) or "").strip()

    or_key = _prioridade("OPENROUTER_API_KEY")
    ollama_chat = (
        _prioridade("OLLAMA_CHAT_MODEL")
        or _prioridade("LLAMA_MODEL")
        or DEFAULT_OLLAMA_CHAT_MODEL
    ).strip()

    if not or_key and not ollama_chat:
        raise RuntimeError(
            f"Defina OLLAMA_CHAT_MODEL ou LLAMA_MODEL (Ollama local, ex. {DEFAULT_OLLAMA_CHAT_MODEL}) "
            "ou OPENROUTER_API_KEY em backend/.env."
        )
    # Mesmo modelo que o Node usa para JSON: o worker Python lê OLLAMA_CHAT_MODEL.
    if ollama_chat and not (os.getenv("OLLAMA_CHAT_MODEL") or "").strip():
        os.environ["OLLAMA_CHAT_MODEL"] = ollama_chat
