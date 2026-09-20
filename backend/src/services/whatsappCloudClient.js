import { env } from "../config.js";

/**
 * @returns {boolean}
 */
export function isWhatsappCloudEnabled() {
  return Boolean(env.WHATSAPP_CLOUD_ENABLED);
}

/**
 * @returns {boolean}
 */
export function isWhatsappCloudConfigured() {
  return Boolean(
    env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() &&
      env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim(),
  );
}

function graphVersion() {
  return String(env.WHATSAPP_CLOUD_API_VERSION || "v21.0").trim() || "v21.0";
}

function phoneNumberId() {
  return String(env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || "").trim();
}

function accessToken() {
  return String(env.WHATSAPP_CLOUD_ACCESS_TOKEN || "").trim();
}

/**
 * @param {string} toDigits
 */
export function normalizeCloudRecipient(toDigits) {
  return String(toDigits || "")
    .split("@")[0]
    .replace(/\D/g, "");
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 */
async function graphFetch(path, init = {}, timeoutMs = 60_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const raw = await response.text();
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { message: raw };
    }
    return { response, parsed, raw };
  } finally {
    clearTimeout(timer);
  }
}

function graphError(parsed, fallback) {
  const err = parsed?.error;
  if (err && typeof err === "object") {
    return String(err.error_user_msg || err.message || fallback);
  }
  return fallback;
}

/**
 * @param {string} to
 * @param {string} text
 */
export async function whatsappCloudSendText(to, text) {
  if (!isWhatsappCloudConfigured()) {
    return { ok: false, error: "WhatsApp Cloud API sem token ou Phone number ID." };
  }
  const recipient = normalizeCloudRecipient(to);
  const body = String(text || "").trim();
  if (!recipient || !body) {
    return { ok: false, error: "Destinatário ou texto vazio." };
  }

  const { response, parsed } = await graphFetch(`/${phoneNumberId()}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  if (!response.ok) {
    return { ok: false, error: graphError(parsed, `HTTP ${response.status}`), parsed };
  }
  return { ok: true, message_id: parsed?.messages?.[0]?.id || null, parsed };
}

/**
 * @param {string} to
 * @param {string} imageUrl
 * @param {string} [caption]
 */
export async function whatsappCloudSendImageUrl(to, imageUrl, caption = "") {
  if (!isWhatsappCloudConfigured()) {
    return { ok: false, error: "WhatsApp Cloud API sem token ou Phone number ID." };
  }
  const recipient = normalizeCloudRecipient(to);
  const link = String(imageUrl || "").trim();
  if (!recipient || !link) {
    return { ok: false, error: "Destinatário ou URL da imagem vazia." };
  }

  /** @type {Record<string, unknown>} */
  const image = { link };
  const cap = String(caption || "").trim();
  if (cap) image.caption = cap;

  const { response, parsed } = await graphFetch(`/${phoneNumberId()}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "image",
      image,
    }),
  });

  if (!response.ok) {
    return { ok: false, error: graphError(parsed, `HTTP ${response.status}`), parsed };
  }
  return { ok: true, message_id: parsed?.messages?.[0]?.id || null, parsed };
}

/**
 * Assina o app nos webhooks da WABA (mensagens).
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function whatsappCloudSubscribeApp() {
  const waba = String(env.WHATSAPP_CLOUD_WABA_ID || "").trim();
  if (!waba || !accessToken()) {
    return { ok: false, error: "WHATSAPP_CLOUD_WABA_ID ou token ausente." };
  }
  const { response, parsed } = await graphFetch(`/${waba}/subscribed_apps`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    return { ok: false, error: graphError(parsed, `HTTP ${response.status}`) };
  }
  return { ok: true };
}

/**
 * @returns {Promise<{ ok: boolean, phone_number_id?: string, display_phone_number?: string, status?: string, platform_type?: string, error?: string }>}
 */
export async function whatsappCloudCheckPhone() {
  if (!isWhatsappCloudConfigured()) {
    return { ok: false, error: "Cloud API não configurada." };
  }
  const { response, parsed } = await graphFetch(
    `/${phoneNumberId()}?fields=id,display_phone_number,verified_name,code_verification_status,status,platform_type`,
    { method: "GET" },
  );
  if (!response.ok) {
    return { ok: false, error: graphError(parsed, `HTTP ${response.status}`) };
  }
  return {
    ok: String(parsed?.status || "").toUpperCase() === "CONNECTED",
    phone_number_id: String(parsed?.id || phoneNumberId()),
    display_phone_number: parsed?.display_phone_number,
    status: parsed?.status,
    platform_type: parsed?.platform_type,
  };
}
