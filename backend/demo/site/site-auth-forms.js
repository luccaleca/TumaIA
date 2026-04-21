/**
 * Login e cadastro nas páginas do site (sem o shell da demo com sidebar).
 * Mesmo token que `demo.js` (`tuma_demo_access_token`).
 */
const AUTH_TOKEN_KEY = "tuma_demo_access_token";

function getApiBase() {
  if (typeof location !== "undefined" && location.origin && location.origin !== "null") {
    return location.origin.replace(/\/$/, "");
  }
  return "";
}

function normalizeEmailClient(s) {
  return typeof s === "string" ? s.trim().toLowerCase() : s;
}

function normalizeSenhaClient(s) {
  return typeof s === "string" ? s.normalize("NFC").trim() : s;
}

function formatAuthError(json) {
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

const DEFAULT_FETCH_TIMEOUT_MS = 25000;

async function authApiFetch(path, opts = {}) {
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
    const r = await fetch(url, {
      ...fetchRest,
      headers,
      signal: controller.signal,
    });
    clearTimeout(tid);
    const text = await r.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _parseError: "resposta não é JSON", raw: text };
    }
    return { ok: r.ok, status: r.status, json };
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

function saveToken(token) {
  try {
    if (token) sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    else sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function setMsg(el, text, kind) {
  if (!el) return;
  if (!text) {
    el.hidden = true;
    el.textContent = "";
    el.className = "site-auth-msg";
    return;
  }
  el.hidden = false;
  el.className = kind === "err" ? "site-auth-msg site-auth-msg--err" : "site-auth-msg site-auth-msg--ok";
  el.textContent = text;
}

async function redirectIfLoggedIn() {
  let token;
  try {
    token = sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    token = null;
  }
  if (!token) return;
  try {
    const r = await fetch(`${getApiBase()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      window.location.replace("../index.html");
    }
  } catch {
    /* ignore */
  }
}

function initLoginPage() {
  const form = document.getElementById("formLogin");
  const emailEl = document.getElementById("authLoginEmail");
  const senhaEl = document.getElementById("authLoginSenha");
  const btn = document.getElementById("authBtnLogin");
  const msg = document.getElementById("authLoginMsg");
  if (!form || !emailEl || !senhaEl || !btn) return;

  const params = new URLSearchParams(window.location.search);
  const preEmail = params.get("email");
  if (preEmail && !emailEl.value) {
    emailEl.value = preEmail;
  }
  if (params.get("cadastro") === "ok") {
    setMsg(msg, "Cadastro concluído. Entre com sua senha.", "ok");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = normalizeEmailClient(emailEl.value);
    const senha = normalizeSenhaClient(senhaEl.value);
    emailEl.value = email;
    btn.disabled = true;
    setMsg(msg, "Entrando…", "ok");
    try {
      const result = await authApiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha }),
      });
      if (!result.ok || result.networkError) {
        const detail =
          result.networkError?.message ||
          formatAuthError(result.json) ||
          "Não foi possível entrar. Verifique e-mail e senha.";
        setMsg(msg, detail, "err");
        saveToken(null);
        return;
      }
      const token = result.json?.access_token;
      if (!token) {
        setMsg(msg, "Resposta inválida do servidor.", "err");
        saveToken(null);
        return;
      }
      saveToken(token);
      window.location.assign("../index.html");
    } catch (err) {
      setMsg(msg, err instanceof Error ? err.message : String(err), "err");
      saveToken(null);
    } finally {
      btn.disabled = false;
    }
  });
}

function initCadastroPage() {
  const form = document.getElementById("formCadastro");
  const btn = document.getElementById("authBtnCadastro");
  const msg = document.getElementById("authCadastroMsg");
  if (!form || !btn) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const senha = normalizeSenhaClient(document.getElementById("authRegSenha")?.value);
    const senhaConfirm = normalizeSenhaClient(document.getElementById("authRegSenhaConfirm")?.value);

    if (senha.length < 8) {
      setMsg(msg, "A senha deve ter no mínimo 8 caracteres.", "err");
      return;
    }
    if (senha !== senhaConfirm) {
      setMsg(msg, "Senha e confirmação não conferem.", "err");
      return;
    }

    const telRaw = document.getElementById("authRegTel")?.value.trim() || "";
    const body = {
      nome: document.getElementById("authRegNome")?.value.trim() || "",
      email: normalizeEmailClient(document.getElementById("authRegEmail")?.value || ""),
      senha,
      telefone: telRaw ? telRaw : null,
    };
    if (!body.nome || !body.email) {
      setMsg(msg, "Preencha nome e e-mail.", "err");
      return;
    }

    btn.disabled = true;
    setMsg(msg, "Enviando cadastro…", "ok");
    try {
      const result = await authApiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!result.ok || result.networkError) {
        const detail =
          result.networkError?.message ||
          formatAuthError(result.json) ||
          "Não foi possível concluir o cadastro.";
        setMsg(msg, detail, "err");
        return;
      }
      const emailCad = result.json?.email || body.email;
      const q = new URLSearchParams({ cadastro: "ok", email: emailCad });
      window.location.assign(`login.html?${q.toString()}`);
    } catch (err) {
      setMsg(msg, err instanceof Error ? err.message : String(err), "err");
    } finally {
      btn.disabled = false;
    }
  });

  document.querySelectorAll(".auth-password-toggle").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-target");
      const input = id ? document.getElementById(id) : null;
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      b.textContent = show ? "Ocultar" : "Mostrar";
      b.setAttribute("aria-pressed", show ? "true" : "false");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body?.dataset?.authPage;
  redirectIfLoggedIn().then(() => {
    if (page === "login") initLoginPage();
    else if (page === "cadastro") initCadastroPage();
  });
});
