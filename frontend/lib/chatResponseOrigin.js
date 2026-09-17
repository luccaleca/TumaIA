/** Rotas de repertório / instruções fixas (sem LLM cloud). */
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
 * @param {{ chat_engine?: string, chat_route?: string, chat_source?: string } | null | undefined} message
 */
export function isCloudChatMessage(message) {
  const source = typeof message?.chat_source === "string" ? message.chat_source.trim() : "";
  if (source === "cloud") return true;
  const engine = typeof message?.chat_engine === "string" ? message.chat_engine.trim() : "";
  if (engine === "cloud_agent") return true;
  const route = typeof message?.chat_route === "string" ? message.chat_route.trim() : "";
  return route.startsWith("cloud_");
}

/**
 * @param {{ chat_engine?: string, chat_route?: string } | null | undefined} message
 */
export function isInstructionChatMessage(message) {
  if (isCloudChatMessage(message)) return false;
  const route = typeof message?.chat_route === "string" ? message.chat_route.trim() : "";
  return Boolean(route && INSTRUCTION_ROUTES.has(route));
}

/**
 * Classes Tailwind da bolha da assistente.
 * Cores de diagnóstico (azul=cloud / vermelho=roteiro) foram removidas do painel.
 * @param {{ chat_engine?: string, chat_route?: string } | null | undefined} _message
 */
export function assistantBubbleSurfaceClass(_message) {
  return "border-border bg-background text-foreground";
}
