const TOKEN_KEY = "tuma_demo_access_token";
const REFRESH_TOKEN_KEY = "tuma_demo_refresh_token";
const API_BASE_KEY = "tuma_demo_api_base";
/** Só desenvolvimento: o layout do painel ignora `fetchMe` se esta chave estiver em sessionStorage. */
export const DEV_DASHBOARD_PREVIEW_KEY = "tuma_dev_dashboard_preview";
const DEFAULT_FETCH_TIMEOUT_MS = 25000;

/** Prefixo proxied pelo Next (`next.config.mjs`) até o backend; porta só em backend/.env. */
const NEXT_DEV_PROXY_PREFIX = "/tumaia-backend";

export function getApiBase() {
  /* Deploy / cenário especial: URL absoluta da API. */
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
  /* Browser: mesmo host do site → rewrite no Next para 127.0.0.1:PORT do backend/.env */
  if (typeof window !== "undefined") {
    return NEXT_DEV_PROXY_PREFIX;
  }
  /* SSR (raro aqui): fala direto com o localhost padrão; alinhar com PORT no back em dev */
  return "http://127.0.0.1:4000";
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

export function saveToken(token, refreshToken = undefined) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
    if (refreshToken !== undefined) {
      if (refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      else sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
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
  saveToken(null, null);
}

export function clearDevDashboardPreview() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DEV_DASHBOARD_PREVIEW_KEY);
  } catch {
    /* ignore */
  }
}

export function loadRefreshToken() {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

let refreshInFlight = null;

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = loadRefreshToken();
    if (!refreshToken) return null;

    const result = await authApiFetch("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!result.ok || result.networkError) {
      clearToken();
      return null;
    }

    const nextAccess = result.json?.access_token;
    const nextRefresh = result.json?.refresh_token;
    if (!nextAccess) {
      clearToken();
      return null;
    }

    // Supabase pode rotacionar refresh token; se não vier, preserva o atual.
    saveToken(nextAccess, nextRefresh || refreshToken);
    return nextAccess;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function messageForFetchTimeout(timeoutMs, requestLabel) {
  const label = String(requestLabel || "").trim();
  if (label === "chat") {
    return "A IA demorou demais para responder. Aguarde um instante e tente de novo (se persistir, reinicie o backend e o chat-worker).";
  }
  if (label === "post-context") {
    return "O resumo demorou mais que o esperado. Tente de novo em instantes.";
  }
  if (label === "image-preview") {
    return "A geração da imagem demorou mais que o limite (cerca de 5 minutos). Aguarde e tente de novo.";
  }
  if (label === "identidade") {
    return "A análise demorou demais. Aguarde um instante e tente de novo.";
  }
  if (timeoutMs > DEFAULT_FETCH_TIMEOUT_MS) {
    return "A operação demorou demais. Aguarde um instante e tente de novo.";
  }
  return "Tempo esgotado — verifique se o backend está rodando.";
}

export async function authApiFetch(path, opts = {}) {
  const timeoutMs =
    typeof opts.timeoutMs === "number" ? opts.timeoutMs : DEFAULT_FETCH_TIMEOUT_MS;
  const timeoutLabel =
    typeof opts.timeoutLabel === "string" ? opts.timeoutLabel : "";
  const { headers: hdrIn, timeoutLabel: _tl, ...fetchRest } = opts;
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
        networkError: new Error(messageForFetchTimeout(timeoutMs, timeoutLabel)),
      };
    }
    return { ok: false, status: 0, json: null, networkError: err };
  }
}

export async function authApiFetchWithToken(path, opts = {}) {
  let token = loadToken();
  if (!token) {
    return { ok: false, status: 401, json: { error: "Sessão não encontrada" } };
  }
  const headers = {
    ...(opts.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const first = await authApiFetch(path, { ...opts, headers });
  if (first.status !== 401) return first;

  token = await refreshAccessToken();
  if (!token) {
    return first;
  }

  const retryHeaders = {
    ...(opts.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return authApiFetch(path, { ...opts, headers: retryHeaders });
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
