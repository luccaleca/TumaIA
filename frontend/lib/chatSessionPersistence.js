/**
 * Mantém rascunho do chat (texto digitado + conversa em andamento) ao sair da página
 * e voltar (ex.: consultar Mídias no painel).
 */

const MAX_CACHED_MESSAGES = 48;

export function chatSessionStorageKey(empresaId) {
  return `tuma_chat_session_${empresaId || "none"}`;
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

/**
 * @param {unknown} raw
 * @returns {Array<Record<string, unknown>> | null}
 */
function normalizeCachedMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = m.role === "user" || m.role === "assistant" ? m.role : null;
    const content = typeof m.content === "string" ? m.content : "";
    if (!role || !content.trim()) continue;
    out.push({
      id: typeof m.id === "string" && m.id.trim() ? m.id : crypto.randomUUID(),
      role,
      content,
      ...(Array.isArray(m.sources) && m.sources.length ? { sources: m.sources } : {}),
      ...(Array.isArray(m.ui_actions) && m.ui_actions.length ? { ui_actions: m.ui_actions } : {}),
      ...(Array.isArray(m.image_urls) && m.image_urls.length ? { image_urls: m.image_urls } : {}),
      ...(Array.isArray(m.image_midia_ids) && m.image_midia_ids.length
        ? { image_midia_ids: m.image_midia_ids }
        : {}),
      ...(Array.isArray(m.image_storage_paths) && m.image_storage_paths.length
        ? { image_storage_paths: m.image_storage_paths }
        : {}),
      ...(m.post_supplement && typeof m.post_supplement === "object" ? { post_supplement: m.post_supplement } : {}),
      ...(m.hidden ? { hidden: true } : {}),
      ...(typeof m.selected_contexto_id === "string" ? { selected_contexto_id: m.selected_contexto_id } : {}),
    });
    if (out.length >= MAX_CACHED_MESSAGES) break;
  }
  return out.length ? out : null;
}

/**
 * @param {string | null | undefined} empresaId
 * @param {{ conversaId?: string | null, input?: string, messages?: unknown[] }} payload
 */
function hasSessionStorage() {
  return typeof sessionStorage !== "undefined";
}

export function saveChatSession(empresaId, payload) {
  if (!empresaId || !hasSessionStorage()) return;
  const conversaId = payload.conversaId && isUuid(payload.conversaId) ? payload.conversaId : null;
  const input = typeof payload.input === "string" ? payload.input : "";
  const messages = normalizeCachedMessages(payload.messages) || [];

  if (!conversaId && !input.trim() && !messages.length) {
    try {
      sessionStorage.removeItem(chatSessionStorageKey(empresaId));
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    sessionStorage.setItem(
      chatSessionStorageKey(empresaId),
      JSON.stringify({
        conversaId,
        input,
        messages,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    /* quota — tenta só id + input */
    try {
      sessionStorage.setItem(
        chatSessionStorageKey(empresaId),
        JSON.stringify({ conversaId, input, messages: [], updatedAt: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {string | null | undefined} empresaId
 */
export function loadChatSession(empresaId) {
  if (!empresaId || !hasSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(chatSessionStorageKey(empresaId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const conversaId = isUuid(data.conversaId) ? data.conversaId : null;
    const input = typeof data.input === "string" ? data.input : "";
    const messages = normalizeCachedMessages(data.messages) || [];
    return { conversaId, input, messages, updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0 };
  } catch {
    return null;
  }
}

/**
 * @param {string | null | undefined} empresaId
 */
export function clearChatSession(empresaId) {
  if (!empresaId || !hasSessionStorage()) return;
  try {
    sessionStorage.removeItem(chatSessionStorageKey(empresaId));
  } catch {
    /* ignore */
  }
}
