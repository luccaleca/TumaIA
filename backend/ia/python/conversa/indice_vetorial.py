"""Criação e carregamento do índice Chroma sobre ``backend/contextos``."""

import os
import shutil
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_community.vectorstores import Chroma

from . import configuracao
from .provedores import embedding_function


def _force_reindex() -> bool:
    v = (os.getenv("TUMACORE_FORCE_REINDEX") or "").strip().lower()
    return v in ("1", "true", "yes", "on", "sim")


def criar_ou_carregar_indice(pasta_docs: Path, pasta_indice: Path) -> Chroma:
    embeddings = embedding_function()

    if _force_reindex() and pasta_indice.exists():
        shutil.rmtree(pasta_indice, ignore_errors=True)

    if pasta_indice.exists() and any(pasta_indice.iterdir()):
        return Chroma(
            persist_directory=str(pasta_indice),
            embedding_function=embeddings,
        )

    loader = DirectoryLoader(
        str(pasta_docs),
        glob="**/*.*",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"},
        show_progress=True,
        use_multithreading=True,
    )
    documentos = loader.load()
    if not documentos:
        pasta_indice.mkdir(parents=True, exist_ok=True)
        return Chroma(
            persist_directory=str(pasta_indice),
            embedding_function=embeddings,
        )

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
    )
    chunks = splitter.split_documents(documentos)
    if not chunks:
        pasta_indice.mkdir(parents=True, exist_ok=True)
        return Chroma(
            persist_directory=str(pasta_indice),
            embedding_function=embeddings,
        )

    vetor_store = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=str(pasta_indice),
    )
    vetor_store.persist()
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
