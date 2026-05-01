const TOKEN_KEY = "tuma_demo_access_token";
const API_BASE_KEY = "tuma_demo_api_base";
const DEFAULT_FETCH_TIMEOUT_MS = 25000;

export function getApiBase() {
  const envBase = process.env.NEXT_PUBLIC_API_BASE;
  if (typeof envBase === "string" && envBase.trim()) {
    return envBase.trim().replace(/\/$/, "");
  }
  try {
    const override = localStorage.getItem(API_BASE_KEY);
    if (override && override.trim()) {
      return override.trim().replace(/\/$/, "");
    }
  } catch {
    /* ignore */
  }
  return "http://localhost:4000";
}

export function normalizeEmailClient(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeSenhaClient(value) {
  return typeof value === "string" ? value.normalize("NFC").trim() : "";
}

export function formatAuthError(json) {
  if (!json || typeof json !== "object") return null;
  const err = json.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    try {
      return JSON.stringify(err);
    } catch {
      return "Erro na requisição";
    }
  }
  return null;
}

export function saveToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function loadToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken() {
  saveToken(null);
}

export async function authApiFetch(path, opts = {}) {
  const timeoutMs =
    typeof opts.timeoutMs === "number" ? opts.timeoutMs : DEFAULT_FETCH_TIMEOUT_MS;
  const { headers: hdrIn, ...fetchRest } = opts;
  const base = getApiBase();
  const url = `${base}${path}`;
  const headers = { ...hdrIn };
  if (fetchRest.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...fetchRest,
      headers,
      signal: controller.signal,
    });
    clearTimeout(tid);
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _parseError: "resposta não é JSON", raw: text };
    }
    return { ok: response.ok, status: response.status, json };
  } catch (networkError) {
    clearTimeout(tid);
    const err = networkError;
    if (err?.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        json: null,
        networkError: new Error("Tempo esgotado — verifique se o backend está rodando."),
      };
    }
    return { ok: false, status: 0, json: null, networkError: err };
  }
}

export async function authApiFetchWithToken(path, opts = {}) {
  const token = loadToken();
  if (!token) {
    return { ok: false, status: 401, json: { error: "Sessão não encontrada" } };
  }
  const headers = {
    ...(opts.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return authApiFetch(path, { ...opts, headers });
}

export async function fetchMe() {
  const result = await authApiFetchWithToken("/auth/me");
  if (!result.ok || result.networkError) return { ok: false, result, usuario: null };
  return { ok: true, result, usuario: result.json?.usuario || null };
}

export async function hasValidSession() {
  const me = await fetchMe();
  return me.ok;
}
