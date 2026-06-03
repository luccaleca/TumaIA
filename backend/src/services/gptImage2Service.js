import { env } from "../config.js";
import { recordImageGenerationOutcome } from "./imageBilling.js";
import { fetchImageBuffer } from "./llamaVisionImage.js";

const OPENAI_IMAGES = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_EDITS = "https://api.openai.com/v1/images/edits";
const EDIT_FETCH_MAX_BYTES = 20 * 1024 * 1024;

/** @type {Record<string, string>} */
const ASPECT_TO_SIZE = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

/**
 * @param {unknown} payload
 * @returns {string[]}
 */
function urlsFromOpenAiResponse(payload) {
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
 * Geração com OpenAI GPT Image 2 (`POST /v1/images/generations`).
 *
 * @param {string} apiKey
 * @param {{
 *   prompt: string,
 *   aspect_ratio?: string,
 *   quality?: 'low' | 'medium' | 'high' | 'standard',
 * }} data
 */
/**
 * Referências + recomposição (como `images.edit` da API oficial com vários PNGs).
 *
 * @param {string} apiKey
 * @param {{
 *   prompt: string,
 *   image_urls: string[],
 *   aspect_ratio?: string,
 *   quality?: 'low' | 'medium' | 'high' | 'standard',
 * }} data
 */
export async function executeGptImage2Edit(apiKey, data) {
  const model = (env.OPENAI_IMAGE_MODEL || "gpt-image-2").trim();
  const aspect = String(data.aspect_ratio || "1:1").trim();
  const size = ASPECT_TO_SIZE[aspect] || "1024x1024";
  const quality = data.quality || env.OPENAI_IMAGE_QUALITY || "high";
  const prompt = String(data.prompt || "").trim();
  const imageUrls = (data.image_urls || []).map((u) => String(u || "").trim()).filter(Boolean).slice(0, 4);
  if (!prompt) {
    return { ok: false, status: 400, error: "Prompt vazio.", model };
  }
  if (!imageUrls.length) {
    return { ok: false, status: 400, error: "Nenhuma imagem de referência para edit.", model };
  }

  const controller = new AbortController();
  const timeoutMs = Number(env.OPENAI_IMAGE_TIMEOUT_MS) || 180_000;
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt.slice(0, 32_000));
    form.append("size", size);
    form.append("quality", quality);
    form.append("n", "1");

    for (let i = 0; i < imageUrls.length; i++) {
      const { buffer } = await fetchImageBuffer(imageUrls[i], {
        maxBytes: EDIT_FETCH_MAX_BYTES,
        timeoutMs: 60_000,
        retries: 1,
      });
      const blob = new Blob([buffer], { type: "image/png" });
      form.append("image[]", blob, `ref-${i}.png`);
    }

    const response = await fetch(OPENAI_IMAGE_EDITS, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errMsg =
        payload?.error?.message ||
        payload?.error ||
        `OpenAI images/edits HTTP ${response.status}`;
      await recordImageGenerationOutcome({ ok: false, model, error: String(errMsg) });
      return {
        ok: false,
        status: response.status >= 400 && response.status < 600 ? response.status : 502,
        error: String(errMsg),
        model,
        raw: payload,
      };
    }

    const urls = urlsFromOpenAiResponse(payload);
    if (!urls.length) {
      const errMsg = "OpenAI edits não retornou imagem.";
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
      api: "images/edits",
    };
  } catch (err) {
    const errMsg =
      err instanceof Error && err.name === "AbortError"
        ? "Tempo esgotado ao gerar a imagem."
        : err instanceof Error
          ? err.message
          : String(err);
    await recordImageGenerationOutcome({ ok: false, model, error: errMsg });
    return { ok: false, status: 504, error: errMsg, model };
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Geração ou edição com referências (URLs públicas/assinadas).
 *
 * @param {string} apiKey
 * @param {{
 *   prompt: string,
 *   input_images?: string[],
 *   aspect_ratio?: string,
 *   quality?: 'low' | 'medium' | 'high' | 'standard',
 * }} data
 */
export async function executeGptImage2WithReferences(apiKey, data) {
  const refs = (data.input_images || []).map((u) => String(u || "").trim()).filter(Boolean);
  if (refs.length) {
    return executeGptImage2Edit(apiKey, { ...data, image_urls: refs });
  }
  return executeGptImage2(data);
}

export async function executeGptImage2(apiKey, data) {
  const model = (env.OPENAI_IMAGE_MODEL || "gpt-image-2").trim();
  const aspect = String(data.aspect_ratio || "1:1").trim();
  const size = ASPECT_TO_SIZE[aspect] || "1024x1024";
  const quality = data.quality || env.OPENAI_IMAGE_QUALITY || "high";
  const prompt = String(data.prompt || "").trim();
  if (!prompt) {
    return { ok: false, status: 400, error: "Prompt vazio.", model };
  }

  const controller = new AbortController();
  const timeoutMs = Number(env.OPENAI_IMAGE_TIMEOUT_MS) || 180_000;
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENAI_IMAGES, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: prompt.slice(0, 32_000),
        size,
        quality,
        n: 1,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errMsg =
        payload?.error?.message ||
        payload?.error ||
        `OpenAI images HTTP ${response.status}`;
      await recordImageGenerationOutcome({ ok: false, model, error: String(errMsg) });
      return {
        ok: false,
        status: response.status >= 400 && response.status < 600 ? response.status : 502,
        error: String(errMsg),
        model,
        raw: payload,
      };
    }

    const urls = urlsFromOpenAiResponse(payload);
    if (!urls.length) {
      const errMsg = "OpenAI não retornou URL nem base64 da imagem.";
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
    };
  } catch (err) {
    const errMsg =
      err instanceof Error && err.name === "AbortError"
        ? "Tempo esgotado ao gerar a imagem."
        : err instanceof Error
          ? err.message
          : String(err);
    await recordImageGenerationOutcome({ ok: false, model, error: errMsg });
    return { ok: false, status: 504, error: errMsg, model };
  } finally {
    clearTimeout(tid);
  }
}

/**
 * @param {string} raw
 */
export function friendlyOpenAiImageError(raw) {
  const s = String(raw || "");
  if (/api[_\s]?key|invalid.*key|authentication/i.test(s)) {
    return "Chave OpenAI inválida ou ausente (OPENAI_API_KEY).";
  }
  if (/billing|quota|insufficient/i.test(s)) {
    return "Cota ou billing da OpenAI. Verifique o painel da conta.";
  }
  if (/content[_\s]?policy|safety|moderation/i.test(s)) {
    return "O pedido foi bloqueado pela moderação da OpenAI. Ajuste o texto e tente de novo.";
  }
  return s.length > 280 ? `${s.slice(0, 279)}…` : s || "Falha ao gerar imagem.";
}
