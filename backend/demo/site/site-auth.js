/**
 * Mesmo token da demo (`demo.js`): mostra Olá + nome nas páginas do site se estiver logado.
 */
const SITE_TOKEN_KEY = "tuma_demo_access_token";
const API_BASE_KEY = "tuma_demo_api_base";

function getApiBase() {
  try {
    const override = localStorage.getItem(API_BASE_KEY);
    if (override && override.trim()) {
      return override.trim().replace(/\/$/, "");
    }
  } catch {
    /* ignore */
  }
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.origin &&
    window.location.origin !== "null"
  ) {
    return window.location.origin;
  }
  return "http://localhost:4000";
}

function displayNameFromUsuario(u) {
  const nome = typeof u?.nome === "string" ? u.nome.trim() : "";
  if (nome) return nome;
  const email = typeof u?.email === "string" ? u.email.trim() : "";
  if (email) return email.split("@")[0] || email;
  return "usuário";
}

async function initSiteHeaderAuth() {
  const greet = document.getElementById("siteUserGreeting");
  const nameEl = document.getElementById("siteUserName");
  const loginL = document.getElementById("siteLinkLogin");
  const cadastroL = document.getElementById("siteLinkCadastro");
  const logoutBtn = document.getElementById("siteBtnLogout");
  const areaLink = document.getElementById("siteLinkAreaUsuario");
  if (!greet || !nameEl || !loginL || !cadastroL) return;

  let token;
  try {
    token = sessionStorage.getItem(SITE_TOKEN_KEY);
  } catch {
    token = null;
  }

  function showGuest() {
    greet.hidden = true;
    loginL.hidden = false;
    cadastroL.hidden = false;
    if (logoutBtn) logoutBtn.hidden = true;
    if (areaLink) areaLink.hidden = true;
    nameEl.textContent = "—";
  }

  function showLogged(name) {
    nameEl.textContent = name;
    greet.hidden = false;
    loginL.hidden = true;
    cadastroL.hidden = true;
    if (logoutBtn) logoutBtn.hidden = false;
    if (areaLink) areaLink.hidden = false;
  }

  if (!token) {
    showGuest();
    return;
  }

  try {
    const r = await fetch(`${getApiBase()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.usuario) {
      throw new Error("sessão inválida");
    }
    showLogged(displayNameFromUsuario(data.usuario));
  } catch {
    try {
      sessionStorage.removeItem(SITE_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    showGuest();
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      try {
        sessionStorage.removeItem(SITE_TOKEN_KEY);
      } catch {
        /* ignore */
      }
      window.location.reload();
    });
  }
}

document.addEventListener("DOMContentLoaded", initSiteHeaderAuth);
