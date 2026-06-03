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
    Trocar de provedor de embedding exige apagar `backend/ia/indice_contextos` **ou** deixar o servidor recriar o índice quando a **dimensão** do vetor mudar (ex.: 3072 OpenRouter → 768 Ollama/nomic); um arquivo `.tumacore_embedding_dim` guarda a dimensão usada na última indexação.
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


def max_chat_output_tokens_natural() -> int:
    """Respostas curtas (fora do escopo) — menos tokens = mais rápido no Ollama."""
    raw = (os.getenv("TUMACORE_MAX_OUTPUT_TOKENS_NATURAL") or "96").strip()
    try:
        return max(40, min(200, int(raw)))
    except ValueError:
        return 96


_llm_lock = threading.Lock()
_llm_singleton = None
_llm_sql_singleton = None
_llm_natural_singleton = None


def _criar_llm(prefer_sql_model: bool = False, *, max_tokens: int | None = None, ollama_model_override: str | None = None):
    """Constrói o cliente LangChain; llm() reutiliza instâncias em memória."""
    ollama_model = (ollama_model_override or os.getenv("OLLAMA_CHAT_MODEL") or "").strip()
    if ollama_model:
        if prefer_sql_model and not ollama_model_override:
            ollama_model = (os.getenv("OLLAMA_SQL_CHAT_MODEL") or ollama_model).strip()
        temp_raw = (os.getenv("OLLAMA_TEMPERATURE") or "0.4").strip().replace(",", ".")
        try:
            temperature = float(temp_raw)
        except ValueError:
            temperature = 0.4
        api_key = (os.getenv("OLLAMA_API_KEY") or "ollama").strip()
        tokens = max_tokens if max_tokens is not None else max_chat_output_tokens()
        return ChatOpenAI(
            model=ollama_model,
            api_key=api_key,
            base_url=ollama_openai_v1_base(),
            temperature=temperature,
            max_tokens=tokens,
        )

    or_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if or_key:
        model = (ollama_model_override or os.getenv("OPENROUTER_CHAT_MODEL") or "meta-llama/llama-3.3-70b-instruct:free").strip()
        if prefer_sql_model and not ollama_model_override:
            model = (os.getenv("OPENROUTER_SQL_CHAT_MODEL") or model).strip()
        temp_raw = (os.getenv("OPENROUTER_TEMPERATURE") or "0.4").strip().replace(",", ".")
        try:
            temperature = float(temp_raw)
        except ValueError:
            temperature = 0.4
        tokens = max_tokens if max_tokens is not None else max_chat_output_tokens()
        return ChatOpenAI(
            model=model,
            api_key=or_key,
            base_url=openrouter_base_url(),
            temperature=temperature,
            max_tokens=tokens,
            default_headers=openrouter_headers(),
        )
    raise RuntimeError(
        "Defina OLLAMA_CHAT_MODEL (Ollama local, ex. qwen2.5:3b) ou OPENROUTER_API_KEY em config/.env."
    )


def llm():
    global _llm_singleton
    if _llm_singleton is not None:
        return _llm_singleton
    with _llm_lock:
        if _llm_singleton is None:
            _llm_singleton = _criar_llm()
    return _llm_singleton


def llm_conversa_aberta():
    """
    Modelo enxuto para curiosidades / fora do escopo (menos latência).
    OLLAMA_FAST_CHAT_MODEL (ex.: qwen2.5:1.5b) ou o mesmo OLLAMA_CHAT_MODEL com menos tokens.
    """
    global _llm_natural_singleton
    if _llm_natural_singleton is not None:
        return _llm_natural_singleton
    with _llm_lock:
        if _llm_natural_singleton is None:
            fast = (os.getenv("OLLAMA_FAST_CHAT_MODEL") or "").strip()
            or_fast = (os.getenv("OPENROUTER_FAST_CHAT_MODEL") or "").strip()
            override = fast or or_fast or None
            _llm_natural_singleton = _criar_llm(
                max_tokens=max_chat_output_tokens_natural(),
                ollama_model_override=override,
            )
    return _llm_natural_singleton


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
