import { env } from "../config.js";
import { fetchImageBuffer } from "./llamaVisionImage.js";
import { normalizeWhatsappPhone, isPlausibleAuthPhone } from "./whatsappPhoneAuth.js";

const WPP_API_TIMEOUT_MS = 120_000;

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
  const timeoutMs = Number(options.timeoutMs) || 0;
  const { timeoutMs: _drop, ...fetchOpts } = options;
  let timer;
  try {
    if (timeoutMs > 0) {
      const ac = new AbortController();
      timer = setTimeout(() => ac.abort(), timeoutMs);
      fetchOpts.signal = ac.signal;
    }
    const response = await fetch(url, fetchOpts);
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {string} recipient
 */
function buildOutboundPhoneBody(recipient) {
  const phone = formatRecipient(recipient);
  return {
    phone,
    isGroup: false,
    isLid: /@lid$/i.test(phone),
  };
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
  const session = await ensureWppconnectSession();
  if (!session.ok) {
    return { ok: false, error: session.error || "WhatsApp desconectado." };
  }

  const token = await getWppconnectToken();
  const phoneBody = buildOutboundPhoneBody(recipient);
  const text = String(message || "").trim();
  if (!phoneBody.phone || !text) return { ok: false, error: "Telefone ou mensagem vazios." };

  const url = `${baseUrl()}/api/${encodeURIComponent(sessionName())}/send-message`;
  const { response, payload } = await fetchJson(url, {
    method: "POST",
    timeoutMs: 60_000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...phoneBody,
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
  const session = await ensureWppconnectSession();
  if (!session.ok) {
    return { ok: false, error: session.error || "WhatsApp desconectado." };
  }

  const token = await getWppconnectToken();
  const phoneBody = buildOutboundPhoneBody(recipient);
  const path = String(imageUrl || "").trim();
  if (!phoneBody.phone || !path) return { ok: false, error: "Telefone ou URL da imagem vazios." };

  /** @type {{ base64?: string, path?: string }} */
  let filePayload = { path };
  try {
    const { buffer, mime } = await fetchImageBuffer(path, {
      maxBytes: 8 * 1024 * 1024,
      timeoutMs: 90_000,
    });
    filePayload = {
      base64: `data:${mime};base64,${buffer.toString("base64")}`,
    };
  } catch (err) {
    console.warn(
      "[wppconnect] download da imagem falhou — tentando URL direta no WPP:",
      err instanceof Error ? err.message : err,
    );
  }

  const url = `${baseUrl()}/api/${encodeURIComponent(sessionName())}/send-file`;
  const { response, payload } = await fetchJson(url, {
    method: "POST",
    timeoutMs: WPP_API_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...phoneBody,
      ...filePayload,
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wppconnectWebhookUrl() {
  const port = env.PORT || 4000;
  return `http://localhost:${port}/wppconnect/webhook`;
}

/** @type {number} */
let lastRecoverAt = 0;
const RECOVER_COOLDOWN_MS = 45_000;
/** @type {Promise<{ ok: boolean, session?: string, status?: string, error?: string }> | null} */
let recoverInFlight = null;

async function wppconnectCloseSessionInternal() {
  const token = await getWppconnectToken();
  const url = `${baseUrl()}/api/${encodeURIComponent(sessionName())}/close-session`;
  await fetchJson(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => ({}));
}

async function wppconnectStartSessionInternal() {
  const token = await getWppconnectToken();
  const url = `${baseUrl()}/api/${encodeURIComponent(sessionName())}/start-session`;
  await fetchJson(url, {
    method: "POST",
    timeoutMs: 120_000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ webhook: wppconnectWebhookUrl() }),
  });
}

/**
 * Reabre sessão zumbi (browser fechou mas status-session ainda diz CONNECTED).
 * @param {{ force?: boolean }} [opts]
 */
export async function ensureWppconnectSession(opts = {}) {
  const check = await wppconnectCheckSession();
  if (check.ok) return check;

  const force = Boolean(opts.force);
  const now = Date.now();
  if (!force && now - lastRecoverAt < RECOVER_COOLDOWN_MS) {
    return check;
  }

  if (recoverInFlight) return recoverInFlight;

  recoverInFlight = (async () => {
    lastRecoverAt = Date.now();
    console.warn("[wppconnect] sessão inativa — fechando e reiniciando…");
    try {
      await wppconnectCloseSessionInternal();
      await sleep(1500);
      await wppconnectStartSessionInternal();

      for (let i = 0; i < 40; i++) {
        await sleep(3000);
        const again = await wppconnectCheckSession();
        if (again.ok) {
          console.info("[wppconnect] sessão recuperada");
          return again;
        }
      }
      return await wppconnectCheckSession();
    } catch (err) {
      return {
        ok: false,
        session: sessionName(),
        error: err instanceof Error ? err.message : "Falha ao recuperar sessão WPPConnect",
      };
    } finally {
      recoverInFlight = null;
    }
  })();

  return recoverInFlight;
}

/** @param {unknown} payload */
function isWppconnectPayloadConnected(payload) {
  if (!payload || typeof payload !== "object") return false;
  const p = /** @type {{ status?: unknown; message?: unknown }} */ (payload);
  if (p.status === true) return true;
  if (p.status === false) return false;
  const msg = String(p.message || "").trim().toLowerCase();
  if (msg === "connected" || msg === "inchat") return true;
  if (msg === "disconnected" || msg === "closed") return false;
  return false;
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
    const message = String(
      (payload && typeof payload === "object" && "message" in payload ? payload.message : "") || "",
    ).trim();
    const connected = response.ok && isWppconnectPayloadConnected(payload);
    const status = message || (connected ? "Connected" : "Disconnected");
    return {
      ok: connected,
      session: sessionName(),
      status,
      error: connected ? undefined : message || `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      session: sessionName(),
      error: err instanceof Error ? err.message : "Erro ao consultar sessão WPPConnect",
    };
  }
}
