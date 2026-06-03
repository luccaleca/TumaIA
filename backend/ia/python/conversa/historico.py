"""Normalização e formatação do histórico da conversa para o prompt."""

import os

# Alinhado a CHAT_PROMPT_HISTORY_MAX em backend/src/services/chatHistoryLimit.js
_DEFAULT_MAX_TURNOS = 48


def _max_turnos_historico() -> int:
    raw = os.getenv("TUMACORE_CHAT_HISTORY_TURNS", str(_DEFAULT_MAX_TURNOS))
    try:
        n = int(raw)
    except ValueError:
        n = _DEFAULT_MAX_TURNOS
    return max(4, min(80, n))


def normalizar_historico(history: list[dict] | None) -> list[dict[str, str]]:
    if not history:
        return []
    out: list[dict[str, str]] = []
    for item in history[-_max_turnos_historico() :]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip().lower()
        content = str(item.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        out.append({"role": role, "content": content})
    return out


def formatar_historico_prompt(history: list[dict[str, str]]) -> str:
    if not history:
        return ""
    linhas = ["HISTÓRICO RECENTE DA CONVERSA:"]
    for turn in history:
        prefixo = "Usuário" if turn["role"] == "user" else "Assistente"
        linhas.append(f"- {prefixo}: {turn['content']}")
    return "\n".join(linhas)
