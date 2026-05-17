const MAX_HTML_BYTES = 800_000;
const MAX_TEXT_CHARS = 12_000;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * @param {string} rawUrl
 */
export function normalizeWebsiteUrl(rawUrl) {
  const s = String(rawUrl || "").trim();
  if (!s) return null;
  let url;
  try {
    url = new URL(s.includes("://") ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null;
  }
  return url.toString();
}

function stripHtmlToText(html) {
  let t = String(html || "");
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const title = (t.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const metaDesc = (t.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || "";
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  const combined = [title.trim(), metaDesc.trim(), t].filter(Boolean).join("\n\n");
  return combined.slice(0, MAX_TEXT_CHARS);
}

/**
 * @param {string} url
 * @returns {Promise<{ url: string, text: string }>}
 */
export async function fetchWebsiteText(url) {
  const normalized = normalizeWebsiteUrl(url);
  if (!normalized) {
    throw new Error("URL do site inválida ou não permitida.");
  }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(normalized, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "TumaIA-BrandSetup/1.0",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) {
      throw new Error(`Não foi possível acessar o site (HTTP ${response.status}).`);
    }
    const buf = await response.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) {
      throw new Error("Página do site muito grande para análise automática.");
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    const text = stripHtmlToText(html);
    if (text.length < 80) {
      throw new Error(
        "Pouco texto extraído do site. Cole a descrição da empresa manualmente ou use um post de exemplo.",
      );
    }
    return { url: normalized, text };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo esgotado ao acessar o site.");
    }
    throw err;
  } finally {
    clearTimeout(tid);
  }
}
