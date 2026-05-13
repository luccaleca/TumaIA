"""LLM de chat e função de embedding (Ollama / OpenRouter)."""

import os
import threading

from langchain_community.embeddings import OllamaEmbeddings
from langchain_core.embeddings import Embeddings
from langchain_openai import ChatOpenAI, OpenAIEmbeddings


def ollama_host() -> str:
    """Host do Ollama sem sufixo /v1 (ex.: http://127.0.0.1:11434)."""
    raw = (
        os.getenv("OLLAMA_HOST") or os.getenv("OLLAMA_BASE_URL") or "http://127.0.0.1:11434"
    ).strip().rstrip("/")
    return raw or "http://127.0.0.1:11434"


def ollama_openai_v1_base() -> str:
    return f"{ollama_host()}/v1"


def openrouter_headers() -> dict[str, str]:
    return {
        "HTTP-Referer": (os.getenv("OPENROUTER_HTTP_REFERER") or "https://localhost").strip(),
        "X-Title": (os.getenv("OPENROUTER_APP_TITLE") or "TumaCore").strip(),
    }


def openrouter_base_url() -> str:
    return (os.getenv("OPENROUTER_BASE_URL") or "https://openrouter.ai/api/v1").strip().rstrip(
        "/"
    )


def embedding_function() -> Embeddings:
    """
    RAG: Ollama (local) ou OpenRouter.
    TUMACORE_USE_OLLAMA_EMBEDDINGS=true força embeddings no Ollama mesmo com OpenRouter.
    Com OLLAMA_CHAT_MODEL definido, embeddings locais (nomic) alinham ao stack Llama.
    Trocar de provedor de embedding exige apagar backend/indice_contextos e subir a API de novo.
    """
    host = ollama_host()
    ollama_embed = (os.getenv("OLLAMA_EMBEDDING_MODEL") or "").strip()
    force_ollama_embed = (os.getenv("TUMACORE_USE_OLLAMA_EMBEDDINGS") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    ollama_chat = (os.getenv("OLLAMA_CHAT_MODEL") or "").strip()

    if ollama_embed or force_ollama_embed:
        return OllamaEmbeddings(
            model=ollama_embed or "nomic-embed-text",
            base_url=host,
        )

    if ollama_chat:
        return OllamaEmbeddings(
            model="nomic-embed-text",
            base_url=host,
        )

    or_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    force_or = (os.getenv("TUMACORE_USE_OPENROUTER_EMBEDDINGS") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    base = openrouter_base_url()
    hdr = openrouter_headers()

    if or_key and force_or:
        model = (os.getenv("OPENROUTER_EMBEDDING_MODEL") or "openai/text-embedding-3-small").strip()
        return OpenAIEmbeddings(
            model=model,
            api_key=or_key,
            base_url=base,
            default_headers=hdr,
        )
    if or_key:
        model = (os.getenv("OPENROUTER_EMBEDDING_MODEL") or "openai/text-embedding-3-small").strip()
        return OpenAIEmbeddings(
            model=model,
            api_key=or_key,
            base_url=base,
            default_headers=hdr,
        )
    return OllamaEmbeddings(
        model=ollama_embed or "nomic-embed-text",
        base_url=host,
    )


def max_chat_output_tokens() -> int:
    raw = (os.getenv("TUMACORE_MAX_OUTPUT_TOKENS") or "160").strip()
    try:
        return max(48, int(raw))
    except ValueError:
        return 160


_llm_lock = threading.Lock()
_llm_singleton = None
_llm_sql_singleton = None


def _criar_llm(prefer_sql_model: bool = False):
    """Constrói o cliente LangChain; llm() reutiliza instâncias em memória."""
    ollama_model = (os.getenv("OLLAMA_CHAT_MODEL") or "").strip()
    if ollama_model:
        if prefer_sql_model:
            ollama_model = (os.getenv("OLLAMA_SQL_CHAT_MODEL") or ollama_model).strip()
        temp_raw = (os.getenv("OLLAMA_TEMPERATURE") or "0.4").strip().replace(",", ".")
        try:
            temperature = float(temp_raw)
        except ValueError:
            temperature = 0.4
        api_key = (os.getenv("OLLAMA_API_KEY") or "ollama").strip()
        max_tokens = max_chat_output_tokens()
        return ChatOpenAI(
            model=ollama_model,
            api_key=api_key,
            base_url=ollama_openai_v1_base(),
            temperature=temperature,
            max_tokens=max_tokens,
        )

    or_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if or_key:
        model = (os.getenv("OPENROUTER_CHAT_MODEL") or "meta-llama/llama-3.3-70b-instruct:free").strip()
        if prefer_sql_model:
            model = (os.getenv("OPENROUTER_SQL_CHAT_MODEL") or model).strip()
        temp_raw = (os.getenv("OPENROUTER_TEMPERATURE") or "0.4").strip().replace(",", ".")
        try:
            temperature = float(temp_raw)
        except ValueError:
            temperature = 0.4
        max_tokens = max_chat_output_tokens()
        return ChatOpenAI(
            model=model,
            api_key=or_key,
            base_url=openrouter_base_url(),
            temperature=temperature,
            max_tokens=max_tokens,
            default_headers=openrouter_headers(),
        )
    raise RuntimeError(
        "Defina OLLAMA_CHAT_MODEL (Ollama local, ex. llama3.2:3b) ou OPENROUTER_API_KEY em config/.env."
    )


def llm():
    global _llm_singleton
    if _llm_singleton is not None:
        return _llm_singleton
    with _llm_lock:
        if _llm_singleton is None:
            _llm_singleton = _criar_llm()
    return _llm_singleton


def llm_para_contexto(sql_context: bool = False):
    """
    Reusa instâncias de LLM e permite um modelo alternativo para fluxo SQL/banco.
    Variáveis opcionais:
    - OLLAMA_SQL_CHAT_MODEL
    - OPENROUTER_SQL_CHAT_MODEL
    """
    global _llm_singleton, _llm_sql_singleton
    if not sql_context:
        return llm()
    if _llm_sql_singleton is not None:
        return _llm_sql_singleton
    with _llm_lock:
        if _llm_sql_singleton is None:
            _llm_sql_singleton = _criar_llm(prefer_sql_model=True)
    return _llm_sql_singleton
