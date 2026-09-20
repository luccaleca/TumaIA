import { isPlausibleAuthPhone, normalizeWhatsappPhone } from "./whatsappPhoneAuth.js";

/**
 * Extrai mensagens de texto do webhook Cloud API (Meta).
 * @param {unknown} body
 * @returns {Array<{
 *   from: string,
 *   chat_id: string,
 *   body: string,
 *   message_id: string | null,
 *   phone_number_id: string,
 *   contact_name: string,
 *   timestamp: string,
 *   type: string,
 * }>}
 */
export function parseWhatsappCloudWebhookMessages(body) {
  if (!body || typeof body !== "object") return [];
  const root = /** @type {Record<string, unknown>} */ (body);
  if (root.object != null && root.object !== "whatsapp_business_account") return [];

  const entries = Array.isArray(root.entry) ? root.entry : [];
  /** @type {ReturnType<typeof parseWhatsappCloudWebhookMessages>} */
  const out = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = Array.isArray(/** @type {Record<string, unknown>} */ (entry).changes)
      ? /** @type {Record<string, unknown>} */ (entry).changes
      : [];
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const ch = /** @type {Record<string, unknown>} */ (change);
      if (ch.field && ch.field !== "messages") continue;
      const value =
        ch.value && typeof ch.value === "object"
          ? /** @type {Record<string, unknown>} */ (ch.value)
          : null;
      if (!value) continue;

      const metadata =
        value.metadata && typeof value.metadata === "object"
          ? /** @type {Record<string, unknown>} */ (value.metadata)
          : {};
      const phoneNumberId = String(metadata.phone_number_id || "").trim();

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      /** @type {Map<string, string>} */
      const namesByWa = new Map();
      for (const c of contacts) {
        if (!c || typeof c !== "object") continue;
        const contact = /** @type {Record<string, unknown>} */ (c);
        const wa = normalizeWhatsappPhone(String(contact.wa_id || ""));
        const profile =
          contact.profile && typeof contact.profile === "object"
            ? /** @type {Record<string, unknown>} */ (contact.profile)
            : {};
        const name = String(profile.name || "").trim();
        if (wa && name) namesByWa.set(wa, name);
      }

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const rawMsg of messages) {
        if (!rawMsg || typeof rawMsg !== "object") continue;
        const msg = /** @type {Record<string, unknown>} */ (rawMsg);
        const type = String(msg.type || "").trim().toLowerCase();
        if (type !== "text") continue;

        const textObj =
          msg.text && typeof msg.text === "object"
            ? /** @type {Record<string, unknown>} */ (msg.text)
            : {};
        const text = String(textObj.body || "").trim();
        if (!text) continue;

        const fromDigits = normalizeWhatsappPhone(String(msg.from || ""));
        if (!fromDigits) continue;

        out.push({
          from: isPlausibleAuthPhone(fromDigits) ? fromDigits : fromDigits,
          chat_id: fromDigits,
          body: text,
          message_id: String(msg.id || "").trim() || null,
          phone_number_id: phoneNumberId,
          contact_name: namesByWa.get(fromDigits) || "",
          timestamp: String(msg.timestamp || ""),
          type,
        });
      }
    }
  }

  return out;
}
