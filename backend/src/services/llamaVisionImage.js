const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 45_000;

const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

/**
 * @param {string} url
 */
function guessMimeFromUrl(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const m = /\.([a-z0-9]+)$/i.exec(path);
    if (m?.[1] && MIME_BY_EXT[m[1]]) return MIME_BY_EXT[m[1]];
  } catch {
    /* ignore */
  }
  return "image/jpeg";
}

/**
 * Baixa imagem HTTP(S) e devolve data URL para modelos vision (Ollama / OpenAI-compat).
 * @param {string} imageUrl
 * @returns {Promise<string>}
 */
export async function fetchImageAsDataUrl(imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("URL da imagem inválida.");
  }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Não foi possível baixar a imagem de referência (HTTP ${res.status}).`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) {
      throw new Error("Imagem muito grande para análise (máx. 4 MB). Use outra do acervo.");
    }
    if (!buf.length) throw new Error("Imagem de referência vazia.");

    const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const mime = ct.startsWith("image/") ? ct : guessMimeFromUrl(url);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo esgotado ao baixar a imagem do acervo.");
    }
    throw err;
  } finally {
    clearTimeout(tid);
  }
}
