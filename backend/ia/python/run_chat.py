"""Execução one-shot do chat IA (stdin JSON -> stdout JSON)."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def _bootstrap_path() -> None:
    base_dir = Path(__file__).resolve().parent
    if str(base_dir) not in sys.path:
        sys.path.insert(0, str(base_dir))


_bootstrap_path()

from conversa.indice_vetorial import construir_vetor_store  # noqa: E402
from conversa.orquestrador import responder_mensagem  # noqa: E402


def main() -> int:
    raw = sys.stdin.read().strip() or "{}"
    payload = json.loads(raw)

    question = str(payload.get("question") or "").strip()
    if not question:
        print(json.dumps({"ok": False, "error": "question obrigatória"}, ensure_ascii=False))
        return 2

    history = payload.get("history")
    if not isinstance(history, list):
        history = []

    id_raw = payload.get("id_empresa")
    id_empresa = id_raw.strip() if isinstance(id_raw, str) and id_raw.strip() else None

    vector_store = construir_vetor_store()
    resposta = responder_mensagem(
        vector_store, question, history=history, id_empresa=id_empresa
    )

    docs = []
    for d in resposta.get("source_documents") or []:
        src = ""
        if hasattr(d, "metadata") and isinstance(d.metadata, dict):
            src = str(d.metadata.get("source") or "")
        docs.append({"source": src})

    print(
        json.dumps(
            {
                "ok": True,
                "result": str(resposta.get("result") or ""),
                "source_documents": docs,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
