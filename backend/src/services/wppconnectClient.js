import { env } from "../config.js";
import { normalizeWhatsappPhone, isPlausibleAuthPhone } from "./whatsappPhoneAuth.js";

function formatRecipient(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/@(c\.us|lid|s\.whatsapp\.net)$/i.test(s)) return s;
  return normalizeWhatsappPhone(s);
}

/** @returns {boolean} */
export function isWppconnectEnabled() {
  return Boolean(env.WPPCONNECT_ENABLED);
}

function baseUrl() {
  return String(env.WPPCONNECT_BASE_URL || "http://127.0.0.1:21465").replace(/\/$/, "");
}

function sessionName() {
  return String(env.WPPCONNECT_SESSION || "tumaia").trim() || "tumaia";
}

/** @type {string | null} */
let cachedToken = env.WPPCONNECT_TOKEN?.trim() || null;
/** @type {number} */
let tokenFetchedAt = 0;
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * @param {string} token
 */
export function setWppconnectTokenForTests(token) {
  cachedToken = token;
  tokenFetchedAt = Date.now();
}

export function clearWppconnectTokenCache() {
  cachedToken = env.WPPCONNECT_TOKEN?.trim() || null;
  tokenFetchedAt = 0;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

/**
 * @returns {Promise<string>}
 */
export async function getWppconnectToken() {
  if (cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  const preset = env.WPPCONNECT_TOKEN?.trim();
  if (preset) {
    cachedToken = preset;
    tokenFetchedAt = Date.now();
    return cachedToken;
  }

  const secret = env.WPPCONNECT_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("Configure WPPCONNECT_TOKEN ou WPPCONNECT_SECRET_KEY no backend/.env");
  }

  const url = `${baseUrl()}/api/${encodeURIComponent(sessionName())}/${encodeURIComponent(secret)}/generate-token`;
  const { response, payload } = await fetchJson(url, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  const token =
    (typeof payload?.token === "string" && payload.token.trim()) ||
    (typeof payload?.full === "string" && payload.full.trim()) ||
    "";

  if (!response.ok || !token) {
    const msg =
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.error === "string" && payload.error) ||
      `Falha ao gerar token WPPConnect (${response.status})`;
    throw new Error(msg);
  }

  cachedToken = token;
  tokenFetchedAt = Date.now();
  return token;
}

/**
 * @param {string} phoneDigits
 * @param {string} message
 */
export async function wppconnectSendText(recipient, message) {
  const token = await getWppconnectToken();
  const phone = formatRecipient(recipient);
  const text = String(message || "").trim();
  if (!phone || !text) return { ok: false, error: "Telefone ou mensagem vazios." };

  const url = `${baseUrl()}/api/${encodeURIComponent(sessionName())}/send-message`;
  const { response, payload } = await fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      phone,
      isGroup: false,
      message: text,
    }),
  });

  if (!response.ok) {
    const msg =
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.error === "string" && payload.error) ||
      `send-message falhou (${response.status})`;
    return { ok: false, status: response.status, error: msg };
  }

  return { ok: true, data: payload };
}

/**
 * @param {string} phoneDigits
 * @param {string} imageUrl
 * @param {string} [caption]
 */
export async function wppconnectSendImageUrl(recipient, imageUrl, caption = "") {
  const token = await getWppconnectToken();
  const phone = formatRecipient(recipient);
  const path = String(imageUrl || "").trim();
  if (!phone || !path) return { ok: false, error: "Telefone ou URL da imagem vazios." };

  const url = `${baseUrl()}/api/${encodeURIComponent(sessionName())}/send-file`;
  const { response, payload } = await fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      phone,
      path,
      caption: String(caption || "").trim() || undefined,
      filename: "tumaia-post.png",
    }),
  });

  if (!response.ok) {
    const msg =
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.error === "string" && payload.error) ||
      `send-file falhou (${response.status})`;
    return { ok: false, status: response.status, error: msg };
  }

  return { ok: true, data: payload };
}

/** @type {Map<string, string>} */
const lidPhoneCache = new Map();

/** Só para testes. */
export function clearWppconnectLidPhoneCache() {
  lidPhoneCache.clear();
}

/**
 * @param {unknown} wid
 * @returns {string}
 */
function extractWidPhoneDigits(wid) {
  if (!wid) return "";
  if (typeof wid === "string") return normalizeWhatsappPhone(wid);
  if (typeof wid === "object") {
    const obj = /** @type {Record<string, unknown>} */ (wid);
    if (typeof obj._serialized === "string") return normalizeWhatsappPhone(obj._serialized);
    if (typeof obj.user === "string") return normalizeWhatsappPhone(obj.user);
  }
  return "";
}

/**
 * Resolve @lid → telefone via WPPConnect (getPnLidEntry).
 * @param {string} pnLid ex.: 169801683091677@lid
 * @returns {Promise<string | null>}
 */
export async function wppconnectResolvePnLid(pnLid) {
  const raw = String(pnLid || "").trim();
  if (!raw || !isWppconnectEnabled()) return null;

  const cacheKey = raw.includes("@") ? raw.toLowerCase() : `${raw.replace(/\D/g, "")}@lid`;
  const cached = lidPhoneCache.get(cacheKey);
  if (cached) return cached;

  try {
    const token = await getWppconnectToken();
    const url = `${baseUrl()}/api/${encodeURIComponent(sessionName())}/contact/pn-lid/${encodeURIComponent(cacheKey)}`;
    const { response, payload } = await fetchJson(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;

    const root = payload?.response && typeof payload.response === "object" ? payload.response : payload;
    const digits =
      extractWidPhoneDigits(root?.phoneNumber) ||
      extractWidPhoneDigits(root?.phone) ||
      extractWidPhoneDigits(root?.contact?.id);

    if (!digits || !isPlausibleAuthPhone(digits)) return null;

    lidPhoneCache.set(cacheKey, digits);
    return digits;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ ok: boolean, session?: string, status?: string, error?: string }>}
 */
export async function wppconnectCheckSession() {
  if (!isWppconnectEnabled()) {
    return { ok: false, error: "WPPCONNECT_ENABLED não está ativo." };
  }
  try {
    const token = await getWppconnectToken();
    const url = `${baseUrl()}/api/${encodeURIComponent(sessionName())}/check-connection-session`;
    const { response, payload } = await fetchJson(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const status = String(payload?.status || payload?.message || "").trim();
    return {
      ok: response.ok,
      session: sessionName(),
      status: status || (response.ok ? "connected" : "unknown"),
      error: response.ok ? undefined : status || `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      session: sessionName(),
      error: err instanceof Error ? err.message : "Erro ao consultar sessão WPPConnect",
    };
  }
}
