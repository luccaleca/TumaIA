import { env } from "../config.js";
import { recordImageGenerationOutcome } from "./imageBilling.js";

const OPENAI_IMAGES = "https://api.openai.com/v1/images/generations";

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
        ? "Tempo esgotado aguardando GPT Image 2."
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
