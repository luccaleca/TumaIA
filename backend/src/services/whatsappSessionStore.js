/** @typedef {{
 *   phone: string,
 *   id_empresa: string,
 *   history: Array<{ role: "user" | "assistant", content: string }>,
 *   post_context_proposal: Record<string, unknown> | null,
 *   post_supplement_links: Array<{ kind: string, id: string }>,
 *   last_image_urls: string[],
 *   last_caption: string | null,
 *   estado: "idle" | "briefing" | "ready_for_image" | "has_image" | "has_caption",
 *   updated_at: number,
 * }} WhatsappSession */

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 500;

/** @type {Map<string, WhatsappSession>} */
const sessions = new Map();

function pruneExpired() {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.updated_at > SESSION_TTL_MS) sessions.delete(key);
  }
  if (sessions.size <= MAX_SESSIONS) return;
  const sorted = [...sessions.entries()].sort((a, b) => a[1].updated_at - b[1].updated_at);
  while (sessions.size > MAX_SESSIONS && sorted.length) {
    const [key] = sorted.shift();
    sessions.delete(key);
  }
}

/**
 * @param {string} phone
 * @param {string} idEmpresa
 * @returns {WhatsappSession}
 */
export function getOrCreateWhatsappSession(phone, idEmpresa) {
  pruneExpired();
  const key = String(phone || "").trim();
  const existing = sessions.get(key);
  if (existing) {
    existing.updated_at = Date.now();
    return existing;
  }
  const session = {
    phone: key,
    id_empresa: idEmpresa,
    history: [],
    post_context_proposal: null,
    post_supplement_links: [],
    last_image_urls: [],
    last_caption: null,
    estado: "idle",
    updated_at: Date.now(),
  };
  sessions.set(key, session);
  return session;
}

/**
 * @param {string} phone
 */
export function resetWhatsappSession(phone) {
  sessions.delete(String(phone || "").trim());
}

/** Só para testes. */
export function clearAllWhatsappSessions() {
  sessions.clear();
}

/**
 * @param {WhatsappSession} session
 * @param {Partial<WhatsappSession>} patch
 */
export function patchWhatsappSession(session, patch) {
  Object.assign(session, patch, { updated_at: Date.now() });
}

/**
 * @param {WhatsappSession} session
 * @param {string} userContent
 * @param {string} assistantContent
 */
export function appendWhatsappTurn(session, userContent, assistantContent) {
  const user = String(userContent || "").trim();
  const assistant = String(assistantContent || "").trim();
  if (user) session.history.push({ role: "user", content: user });
  if (assistant) session.history.push({ role: "assistant", content: assistant });
  session.updated_at = Date.now();
}
