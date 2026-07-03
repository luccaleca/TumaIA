/** Rotas de repertório / instruções fixas (sem LLM Cursor). */
const INSTRUCTION_ROUTES = new Set([
  "identity",
  "identity_llm",
  "out_of_scope",
  "conversa_natural",
  "acervo",
  "empresa",
  "contextos",
  "composite",
  "post_briefing",
]);

/**
 * @param {{ chat_engine?: string, chat_route?: string } | null | undefined} message
 */
export function isCursorChatMessage(message) {
  const source = typeof message?.chat_source === "string" ? message.chat_source.trim() : "";
  if (source === "cursor") return true;
  const engine = typeof message?.chat_engine === "string" ? message.chat_engine.trim() : "";
  if (engine === "cursor_agent") return true;
  const route = typeof message?.chat_route === "string" ? message.chat_route.trim() : "";
  return route.startsWith("cursor_");
}

/**
 * @param {{ chat_engine?: string, chat_route?: string } | null | undefined} message
 */
export function isInstructionChatMessage(message) {
  if (isCursorChatMessage(message)) return false;
  const route = typeof message?.chat_route === "string" ? message.chat_route.trim() : "";
  return Boolean(route && INSTRUCTION_ROUTES.has(route));
}

/**
 * Classes Tailwind da bolha da assistente conforme origem da resposta.
 * @param {{ chat_engine?: string, chat_route?: string } | null | undefined} message
 */
export function assistantBubbleSurfaceClass(message) {
  if (isCursorChatMessage(message)) {
    return "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-50";
  }
  if (isInstructionChatMessage(message)) {
    return "border-red-200 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/45 dark:text-red-50";
  }
  return "border-border bg-background text-foreground";
}
