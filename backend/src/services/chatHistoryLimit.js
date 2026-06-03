/** Máximo de turnos aceitos no POST /ia/chat (últimos N são mantidos). */
export const CHAT_API_HISTORY_MAX = 80;

/** Turnos recentes injetados no prompt do worker Python (conversa/historico.py). */
export const CHAT_PROMPT_HISTORY_MAX = 48;

/**
 * Mantém só os turnos mais recentes (user/assistant com conteúdo).
 * @param {Array<{ role: string, content: string }> | undefined} history
 * @param {number} [max]
 * @returns {Array<{ role: "user" | "assistant", content: string }> | undefined}
 */
export function trimChatHistoryForApi(history, max = CHAT_API_HISTORY_MAX) {
  if (!Array.isArray(history) || !history.length) return undefined;
  const valid = history
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        String(m.content || "").trim().length > 0,
    )
    .map((m) => ({
      role: m.role,
      content: String(m.content).trim(),
    }));
  if (!valid.length) return undefined;
  return valid.length > max ? valid.slice(-max) : valid;
}
