"""
Worker persistente para o chat: carrega o índice vetorial uma vez e responde
várias perguntas via NDJSON (uma linha JSON in → uma linha JSON out).

Evita o custo de iniciar Python + LangChain + Chroma a cada mensagem.
"""

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


def _emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> int:
    try:
        vector_store = construir_vetor_store()
    except Exception as e:  # noqa: BLE001
        _emit({"ok": False, "error": f"Falha ao carregar índice: {e}"})
        return 1

    _emit({"ok": True, "_worker_ready": True})

    for line in sys.stdin:
        raw = line.strip()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            _emit({"ok": False, "error": "JSON inválido na linha de entrada"})
            continue

        question = str(payload.get("question") or "").strip()
        if not question:
            _emit({"ok": False, "error": "question obrigatória"})
            continue

        history = payload.get("history")
        if not isinstance(history, list):
            history = []

        id_raw = payload.get("id_empresa")
        id_empresa = id_raw.strip() if isinstance(id_raw, str) and id_raw.strip() else None

        try:
            resposta = responder_mensagem(
                vector_store, question, history=history, id_empresa=id_empresa
            )
        except Exception as e:  # noqa: BLE001
            _emit({"ok": False, "error": str(e)})
            continue

        docs = []
        for d in resposta.get("source_documents") or []:
            src = ""
            if hasattr(d, "metadata") and isinstance(d.metadata, dict):
                src = str(d.metadata.get("source") or "")
            docs.append({"source": src})

        _emit(
            {
                "ok": True,
                "result": str(resposta.get("result") or ""),
                "source_documents": docs,
            }
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
