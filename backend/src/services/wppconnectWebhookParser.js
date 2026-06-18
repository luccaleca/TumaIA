import { isPlausibleAuthPhone, normalizeWhatsappPhone } from "./whatsappPhoneAuth.js";

/**
 * @param {unknown} value
 */
function pushSenderId(value, bucket) {
  if (value == null) return;
  if (typeof value === "object" && value !== null) {
    const obj = /** @type {Record<string, unknown>} */ (value);
    if (typeof obj._serialized === "string") bucket.push(obj._serialized);
    if (typeof obj.user === "string") {
      const user = obj.user.trim();
      const server = typeof obj.server === "string" ? obj.server.trim() : "";
      bucket.push(server && !user.includes("@") ? `${user}@${server}` : user);
    }
    return;
  }
  const s = String(value).trim();
  if (s) bucket.push(s);
}

/**
 * @param {Record<string, unknown>} root
 * @returns {string[]}
 */
export function extractWhatsappSenderIds(root) {
  const msg =
    root.body && typeof root.body === "object" && !Array.isArray(root.body)
      ? /** @type {Record<string, unknown>} */ (root.body)
      : root;

  const ids = [];
  const sender = msg.sender || root.sender;
  if (sender && typeof sender === "object") {
    const s = /** @type {Record<string, unknown>} */ (sender);
    pushSenderId(s.id, ids);
    pushSenderId(s, ids);
  }
  pushSenderId(msg.from, ids);
  pushSenderId(msg.chatId, ids);
  pushSenderId(msg.author, ids);
  pushSenderId(root.from, ids);
  pushSenderId(msg.chat?.id, ids);
  pushSenderId(root.chatId, ids);

  return [...new Set(ids.filter(Boolean))];
}

/**
 * Telefone para autorização (preferir @c.us, ignorar @lid).
 * @param {string[]} ids
 */
export function pickAuthPhone(ids) {
  for (const id of ids) {
    const raw = String(id);
    if (/@lid$/i.test(raw)) continue;
    const digits = normalizeWhatsappPhone(raw);
    if (isPlausibleAuthPhone(digits)) return digits;
  }
  return "";
}

/**
 * @param {string[]} ids
 * @returns {string | null}
 */
export function pickLidRecipient(ids) {
  for (const id of ids) {
    const raw = String(id).trim();
    if (/@lid$/i.test(raw)) return raw;
  }
  return null;
}

/**
 * ID para responder no WhatsApp (mantém @c.us / @lid quando necessário).
 * @param {string[]} ids
 */
export function pickChatRecipient(ids) {
  for (const id of ids) {
    const s = String(id).trim();
    if (/@(c\.us|lid|s\.whatsapp\.net)$/i.test(s)) return s;
  }
  const phone = pickAuthPhone(ids);
  return phone || String(ids[0] || "").trim();
}

/**
 * Extrai mensagem de texto recebida do webhook do WPPConnect Server.
 * @param {unknown} body
 * @returns {{
 *   event: string,
 *   from: string,
 *   chat_id: string,
 *   sender_ids: string[],
 *   body: string,
 *   message_id: string | null,
 *   is_group: boolean,
 *   from_me: boolean,
 *   type: string,
 * } | null}
 */
export function parseWppconnectWebhookMessage(body) {
  if (!body || typeof body !== "object") return null;

  const root = /** @type {Record<string, unknown>} */ (body);
  const msg =
    root.body && typeof root.body === "object" && !Array.isArray(root.body)
      ? /** @type {Record<string, unknown>} */ (root.body)
      : root;

  const event = String(root.event || root.Event || "").trim().toLowerCase();
  const textRaw = typeof root.body === "string" ? root.body : null;
  const hasMessageFields = Boolean(
    extractWhatsappSenderIds(root).length &&
      (textRaw || (msg.body ?? msg.content ?? msg.text)),
  );
  if (event && event !== "onmessage" && event !== "message") return null;
  if (!event && !hasMessageFields) return null;

  const type = String(msg.type || msg.msgType || "chat").trim().toLowerCase();
  if (type && type !== "chat" && type !== "text") return null;

  const senderIds = extractWhatsappSenderIds(root);
  const from = pickAuthPhone(senderIds);
  const chat_id = pickChatRecipient(senderIds);
  if (!from && !chat_id) return null;

  const text = String(textRaw ?? msg.body ?? msg.content ?? msg.text ?? "").trim();
  if (!text) return null;

  const is_group = Boolean(msg.isGroupMsg ?? msg.isGroup ?? root.isGroupMsg);
  const from_me = Boolean(msg.fromMe ?? msg.from_me ?? root.fromMe);

  const message_id = String(msg.id || msg.messageId || root.id || "").trim() || null;

  return {
    event: event || "onmessage",
    from,
    chat_id: chat_id || (from ? `${from}@c.us` : ""),
    sender_ids: senderIds,
    body: text,
    message_id,
    is_group,
    from_me,
    type,
  };
}
