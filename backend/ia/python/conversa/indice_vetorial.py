"""Criação e carregamento do índice Chroma sobre ``backend/contextos``."""

import gc
import os
import shutil
import sys
import time
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_chroma import Chroma

from . import configuracao
from .provedores import embedding_function

_EMBED_DIM_FILE = ".tumacore_embedding_dim"


def _force_reindex() -> bool:
    v = (os.getenv("TUMACORE_FORCE_REINDEX") or "").strip().lower()
    return v in ("1", "true", "yes", "on", "sim")


def _has_chroma_data(pasta_indice: Path) -> bool:
    if not pasta_indice.is_dir():
        return False
    if (pasta_indice / "chroma.sqlite3").is_file():
        return True
    return any(p.is_file() and p.name != _EMBED_DIM_FILE for p in pasta_indice.iterdir())


def _read_stored_dim(pasta_indice: Path) -> int | None:
    p = pasta_indice / _EMBED_DIM_FILE
    if not p.is_file():
        return None
    try:
        return int(p.read_text(encoding="utf-8").strip())
    except (ValueError, OSError):
        return None


def _write_stored_dim(pasta_indice: Path, dim: int) -> None:
    pasta_indice.mkdir(parents=True, exist_ok=True)
    (pasta_indice / _EMBED_DIM_FILE).write_text(str(dim), encoding="utf-8")


def _embedding_dim(embeddings) -> int:
    return len(embeddings.embed_query("__tumacore_embedding_dim_probe__"))


def _embedding_dimension_mismatch(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return (
        "dimension" in msg
        or "expecting embedding" in msg
        or ("embedding" in msg and "expect" in msg)
        or "3072" in msg
        or "1536" in msg
        or "768" in msg
    )


def _dispose_langchain_chroma(vs: Chroma | None) -> None:
    """
    Fecha handles do Chroma/ChromaDB antes de apagar a pasta no Windows.
    Sem isso, shutil.rmtree costuma falhar e o sqlite antigo (dimensão errada) permanece.
    """
    if vs is None:
        gc.collect()
        return
    for attr in ("_client", "_chroma_client", "client"):
        client = getattr(vs, attr, None)
        if client is None:
            continue
        for meth_name in ("reset", "close", "stop"):
            meth = getattr(client, meth_name, None)
            if callable(meth):
                try:
                    meth()
                except Exception:
                    pass
        try:
            setattr(vs, attr, None)
        except Exception:
            pass
    try:
        del vs
    except Exception:
        pass
    gc.collect()
    time.sleep(0.05)


def _clear_chroma_dir(pasta_indice: Path) -> None:
    """Remove o índice no disco; no Windows pode precisar de mais de uma tentativa (flock)."""
    if not pasta_indice.exists():
        return
    for attempt in range(8):
        shutil.rmtree(pasta_indice, ignore_errors=True)
        if not pasta_indice.exists() or not _has_chroma_data(pasta_indice):
            return
        time.sleep(0.15 * (attempt + 1))
    shutil.rmtree(pasta_indice, ignore_errors=True)


def _quarantine_index_dir(pasta_indice: Path) -> None:
    """Se não der para apagar, renomeia a pasta (evita abrir o sqlite antigo)."""
    if not pasta_indice.exists():
        return
    if not _has_chroma_data(pasta_indice):
        return
    suffix = int(time.time() * 1000) % 1_000_000_000
    dest = pasta_indice.with_name(f"{pasta_indice.name}.bak.{suffix}")
    try:
        pasta_indice.rename(dest)
        return
    except OSError:
        pass
    _clear_chroma_dir(pasta_indice)


def criar_ou_carregar_indice(pasta_docs: Path, pasta_indice: Path) -> Chroma:
    embeddings = embedding_function()
    current_dim = _embedding_dim(embeddings)

    if _force_reindex() and pasta_indice.exists():
        _clear_chroma_dir(pasta_indice)

    load_existing = pasta_indice.exists() and _has_chroma_data(pasta_indice)
    if load_existing:
        stored = _read_stored_dim(pasta_indice)
        if stored is not None and stored != current_dim:
            print(
                f"[chroma] Dimensão do embedding mudou ({stored} → {current_dim}); "
                "recriando índice (apague manualmente com TUMACORE_FORCE_REINDEX=1 se preferir).",
                file=sys.stderr,
            )
            _clear_chroma_dir(pasta_indice)
            if _has_chroma_data(pasta_indice):
                _quarantine_index_dir(pasta_indice)
            load_existing = False

    if load_existing:
        vs: Chroma | None = None
        try:
            vs = Chroma(
                persist_directory=str(pasta_indice),
                embedding_function=embeddings,
            )
            vs.similarity_search_with_score("__tumacore_compat__", k=1)
        except Exception as e:  # noqa: BLE001
            if not _embedding_dimension_mismatch(e):
                _dispose_langchain_chroma(vs)
                raise
            print(
                "[chroma] Índice incompatível com o modelo de embedding atual; recriando.",
                file=sys.stderr,
            )
            _dispose_langchain_chroma(vs)
            vs = None
            _clear_chroma_dir(pasta_indice)
            if _has_chroma_data(pasta_indice):
                _quarantine_index_dir(pasta_indice)
            load_existing = False
        else:
            if _read_stored_dim(pasta_indice) is None:
                _write_stored_dim(pasta_indice, current_dim)
            return vs

    # Reconstrução: sobras de sqlite com dimensão antiga (comum no Windows após 1º rmtree falho)
    if not load_existing and _has_chroma_data(pasta_indice):
        _clear_chroma_dir(pasta_indice)
        if _has_chroma_data(pasta_indice):
            _quarantine_index_dir(pasta_indice)

    loader = DirectoryLoader(
        str(pasta_docs),
        glob="**/*.*",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"},
        show_progress=False,
        use_multithreading=True,
    )
    documentos = loader.load()
    if not documentos:
        pasta_indice.mkdir(parents=True, exist_ok=True)
        if _has_chroma_data(pasta_indice):
            _clear_chroma_dir(pasta_indice)
            if _has_chroma_data(pasta_indice):
                _quarantine_index_dir(pasta_indice)
            pasta_indice.mkdir(parents=True, exist_ok=True)
        store: Chroma | None = None
        try:
            store = Chroma(
                persist_directory=str(pasta_indice),
                embedding_function=embeddings,
            )
        except Exception as e:  # noqa: BLE001
            if not _embedding_dimension_mismatch(e):
                raise
            print("[chroma] índice vazio: sqlite antigo; renomeando/apagando.", file=sys.stderr)
            _dispose_langchain_chroma(store)
            store = None
            _quarantine_index_dir(pasta_indice)
            pasta_indice.mkdir(parents=True, exist_ok=True)
            store = Chroma(
                persist_directory=str(pasta_indice),
                embedding_function=embeddings,
            )
        _write_stored_dim(pasta_indice, current_dim)
        return store

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
    )
    chunks = splitter.split_documents(documentos)
    if not chunks:
        pasta_indice.mkdir(parents=True, exist_ok=True)
        if _has_chroma_data(pasta_indice):
            _clear_chroma_dir(pasta_indice)
            if _has_chroma_data(pasta_indice):
                _quarantine_index_dir(pasta_indice)
            pasta_indice.mkdir(parents=True, exist_ok=True)
        store: Chroma | None = None
        try:
            store = Chroma(
                persist_directory=str(pasta_indice),
                embedding_function=embeddings,
            )
        except Exception as e:  # noqa: BLE001
            if not _embedding_dimension_mismatch(e):
                raise
            print("[chroma] chunks vazios: sqlite antigo; renomeando/apagando.", file=sys.stderr)
            _dispose_langchain_chroma(store)
            store = None
            _quarantine_index_dir(pasta_indice)
            pasta_indice.mkdir(parents=True, exist_ok=True)
            store = Chroma(
                persist_directory=str(pasta_indice),
                embedding_function=embeddings,
            )
        _write_stored_dim(pasta_indice, current_dim)
        return store

    if _has_chroma_data(pasta_indice):
        _clear_chroma_dir(pasta_indice)
        if _has_chroma_data(pasta_indice):
            _quarantine_index_dir(pasta_indice)

    vetor_store = None
    try:
        vetor_store = Chroma.from_documents(
            documents=chunks,
            embedding=embeddings,
            persist_directory=str(pasta_indice),
        )
    except Exception as e:  # noqa: BLE001
        if not _embedding_dimension_mismatch(e):
            raise
        print("[chroma] from_documents falhou por dimensão; limpando e tentando de novo.", file=sys.stderr)
        _dispose_langchain_chroma(vetor_store)
        vetor_store = None
        _clear_chroma_dir(pasta_indice)
        if _has_chroma_data(pasta_indice):
            _quarantine_index_dir(pasta_indice)
        pasta_indice.mkdir(parents=True, exist_ok=True)
        vetor_store = Chroma.from_documents(
            documents=chunks,
            embedding=embeddings,
            persist_directory=str(pasta_indice),
        )
    _write_stored_dim(pasta_indice, current_dim)
    return vetor_store


def construir_vetor_store() -> Chroma:
    """Carrega env e índice Chroma (CLI e API)."""
    backend_dir = Path(__file__).resolve().parent.parent
    root_dir = backend_dir.parent
    configuracao.garantir_ambiente_llm(root_dir)

    pasta_docs = backend_dir / "contextos"
    pasta_docs.mkdir(exist_ok=True)
    pasta_indice = backend_dir / "indice_contextos"

    return criar_ou_carregar_indice(
        pasta_docs=pasta_docs,
        pasta_indice=pasta_indice,
    )
