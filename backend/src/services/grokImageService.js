import { env } from "../config.js";
import { recordImageGenerationOutcome } from "./imageBilling.js";

const XAI_IMAGES = "https://api.x.ai/v1/images/generations";
const XAI_IMAGE_EDITS = "https://api.x.ai/v1/images/edits";

const ALLOWED_ASPECT = new Set([
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "2:1",
  "1:2",
  "auto",
]);

/**
 * Chave da API xAI (Imagine). Não usar CHAT_CLOUD_API_KEY com prefixo `crsr_`.
 * @returns {string}
 */
export function resolveGrokImageApiKey() {
  const xai = String(env.XAI_API_KEY || "").trim();
  if (xai && !looksLikeCrsrPrefixedApiKey(xai)) return xai;

  const cloud = String(env.CHAT_CLOUD_API_KEY || "").trim();
  // Só reutiliza CHAT_CLOUD_API_KEY se for chave xAI de verdade (não crsr_).
  if (cloud && !looksLikeCrsrPrefixedApiKey(cloud)) return cloud;

  return "";
}

/**
 * @param {string} key
 */
export function looksLikeCrsrPrefixedApiKey(key) {
  const k = String(key || "").trim().toLowerCase();
  return k.startsWith("crsr_") || k.startsWith("cursor_");
}

export function resolveGrokImageModel() {
  return String(env.GROK_IMAGE_MODEL || "grok-imagine-image-2.0").trim();
}

/**
 * @param {unknown} payload
 * @returns {string[]}
 */
export function urlsFromGrokImageResponse(payload) {
  const data = payload?.data;
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const item of data) {
    if (item && typeof item.url === "string" && item.url.trim()) {
      out.push(item.url.trim());
      continue;
    }
    const b64 = item?.b64_json;
    if (typeof b64 === "string" && b64.length > 100) {
      out.push(`data:image/png;base64,${b64}`);
    }
  }
  return out;
}

/**
 * Anota o prompt para multi-imagem (`<IMAGE_0>`, …) conforme a doc xAI.
 * @param {string} prompt
 * @param {number} count
 */
export function annotateGrokMultiImagePrompt(prompt, count) {
  const n = Math.max(0, Math.min(5, Number(count) || 0));
  const base = String(prompt || "").trim();
  if (n <= 1) return base;
  const tags = Array.from({ length: n }, (_, i) => `<IMAGE_${i}>`).join(", ");
  return (
    `${base}\n\nReferências de entrada (nesta ordem): ${tags}. ` +
    `Use o produto/logo das imagens indicadas com fidelidade; não invente embalagem.`
  ).slice(0, 32_000);
}

/**
 * @param {string[]} imageUrls
 * @returns {{ image?: { url: string, type: string }, images?: Array<{ url: string, type: string }> }}
 */
export function buildGrokEditImagePayload(imageUrls) {
  const urls = (imageUrls || []).map((u) => String(u || "").trim()).filter(Boolean).slice(0, 5);
  if (!urls.length) return {};
  if (urls.length === 1) {
    return { image: { url: urls[0], type: "image_url" } };
  }
  return {
    images: urls.map((url) => ({ url, type: "image_url" })),
  };
}

function resolveAspect(aspect) {
  const a = String(aspect || "1:1").trim();
  return ALLOWED_ASPECT.has(a) ? a : "1:1";
}

function resolveQuality() {
  const q = String(env.GROK_IMAGE_QUALITY || "auto").trim().toLowerCase();
  if (q === "low" || q === "medium" || q === "auto") return q;
  return "auto";
}

function resolveResolution() {
  const r = String(env.GROK_IMAGE_RESOLUTION || "1k").trim().toLowerCase();
  return r === "2k" ? "2k" : "1k";
}

/**
 * @param {string} errMsg
 */
export function friendlyGrokImageError(errMsg) {
  const s = String(errMsg || "").trim();
  if (!s) return "Falha ao gerar imagem com Grok Imagine.";
  if (/billing|payment|quota|insufficient/i.test(s)) {
    return "Conta xAI sem crédito ou billing bloqueado para imagem. Verifique GROK_ALLOW_BILLING e a chave.";
  }
  if (/api.?key|unauthorized|401/i.test(s)) {
    return (
      "Chave da xAI inválida para gerar imagem. " +
      "CHAT_CLOUD_API_KEY (crsr_…) não autentica api.x.ai — coloque XAI_API_KEY, " +
      "ou use IMAGE_PROVIDER=replicate."
    );
  }
  if (/moderation|safety|content.?policy/i.test(s)) {
    return "A imagem foi bloqueada pela moderação do Grok. Ajuste o pedido ou as referências.";
  }
  return s.length > 280 ? `${s.slice(0, 277)}…` : s;
}

/**
 * @param {string} apiKey
 * @param {{
 *   prompt: string,
 *   aspect_ratio?: string,
 *   input_images?: string[],
 * }} data
 */
export async function executeGrokImagine(apiKey, data) {
  const model = resolveGrokImageModel();
  const promptRaw = String(data.prompt || "").trim();
  if (!promptRaw) {
    return { ok: false, status: 400, error: "Prompt vazio.", model };
  }
  if (!String(apiKey || "").trim()) {
    return { ok: false, status: 503, error: "Chave xAI ausente para Grok Imagine.", model };
  }

  const refs = (data.input_images || []).map((u) => String(u || "").trim()).filter(Boolean).slice(0, 5);
  const aspect = resolveAspect(data.aspect_ratio);
  const quality = resolveQuality();
  const resolution = resolveResolution();
  const prompt = annotateGrokMultiImagePrompt(promptRaw, refs.length);

  const controller = new AbortController();
  const timeoutMs = Number(env.GROK_IMAGE_TIMEOUT_MS) || 180_000;
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  const useEdit = refs.length > 0;
  const endpoint = useEdit ? XAI_IMAGE_EDITS : XAI_IMAGES;
  const body = {
    model,
    prompt: prompt.slice(0, 32_000),
    n: 1,
    aspect_ratio: aspect,
    resolution,
    quality,
    response_format: "b64_json",
    ...buildGrokEditImagePayload(refs),
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errMsg =
        payload?.error?.message ||
        payload?.error ||
        payload?.message ||
        `Grok Imagine HTTP ${response.status}`;
      await recordImageGenerationOutcome({ ok: false, model, error: String(errMsg) });
      return {
        ok: false,
        status: response.status >= 400 && response.status < 600 ? response.status : 502,
        error: String(errMsg),
        model,
        raw: payload,
      };
    }

    const urls = urlsFromGrokImageResponse(payload);
    if (!urls.length) {
      const errMsg = "Grok Imagine não retornou imagem.";
      await recordImageGenerationOutcome({ ok: false, model, error: errMsg });
      return { ok: false, status: 502, error: errMsg, model, raw: payload };
    }

    await recordImageGenerationOutcome({ ok: true, model });
    return {
      ok: true,
      status: 200,
      model,
      output: urls,
      prediction_id: payload?.created ? String(payload.created) : null,
      api: useEdit ? "images/edits" : "images/generations",
    };
  } catch (err) {
    const errMsg =
      err instanceof Error && err.name === "AbortError"
        ? "Tempo esgotado ao gerar a imagem com Grok."
        : err instanceof Error
          ? err.message
          : String(err);
    await recordImageGenerationOutcome({ ok: false, model, error: errMsg });
    return { ok: false, status: 504, error: errMsg, model };
  } finally {
    clearTimeout(tid);
  }
}
