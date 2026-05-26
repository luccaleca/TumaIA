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
 * @param {string} imageUrl
 * @param {{ maxBytes?: number }} [opts]
 * @returns {Promise<{ buffer: Buffer, mime: string }>}
 */
export async function fetchImageBuffer(imageUrl, opts = {}) {
  const url = String(imageUrl || "").trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("URL da imagem inválida.");
  }
  const maxBytes = Math.max(1, Number(opts?.maxBytes) || MAX_IMAGE_BYTES);

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Não foi possível baixar a imagem de referência (HTTP ${res.status}).`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > maxBytes) {
      const sizeMb = Math.max(1, Math.round(maxBytes / (1024 * 1024)));
      throw new Error(`Imagem muito grande para processamento (máx. ${sizeMb} MB).`);
    }
    if (!buffer.length) throw new Error("Imagem de referência vazia.");

    const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const mime = ct.startsWith("image/") ? ct : guessMimeFromUrl(url);
    return { buffer, mime };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo esgotado ao baixar a imagem do acervo.");
    }
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Baixa imagem HTTP(S) e devolve data URL para modelos vision (Ollama / OpenAI-compat).
 * @param {string} imageUrl
 * @returns {Promise<string>}
 */
export async function fetchImageAsDataUrl(imageUrl) {
  const { buffer, mime } = await fetchImageBuffer(imageUrl);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
