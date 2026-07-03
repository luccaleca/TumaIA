import { env } from "../config.js";
import { DEFAULT_OLLAMA_CHAT_MODEL } from "../ollamaDefaults.js";
import { parseJsonFromLlmContent } from "./llamaJsonParse.js";

/**
 * Ollama local com prompt grande (contextos + mídias) costuma levar 60–120s na 1ª chamada.
 * Abaixo disso a proposta de post falha mesmo com o serviço saudável.
 */
const LLAMA_FETCH_TIMEOUT_MS = 120_000;
/** Vision (ex. llava:7b em GPU modesta) pode levar mais na 1ª inferência. */
const LLAMA_VISION_FETCH_TIMEOUT_MS = 240_000;

/** Base OpenAI-compatível (ex.: Ollama `http://127.0.0.1:11434/v1`). */
function baseV1() {
  const raw = (env.LLAMA_BASE_URL || "http://127.0.0.1:11434/v1").trim().replace(/\/+$/, "");
  if (!raw) return "http://127.0.0.1:11434/v1";
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

/**
 * @param {Array<{ role: string, content: string | Array<Record<string, unknown>> }>} messages
 * @param {{
 *   temperature?: number,
 *   model?: string,
 *   responseFormatJson?: boolean,
 *   expectJson?: boolean,
 *   timeoutMs?: number,
 *   timeoutMessage?: string,
 * }} [options]
 */
async function llamaChatCompletionFromMessages(messages, options = {}) {
  const {
    temperature = 0.35,
    model,
    responseFormatJson = true,
    expectJson = responseFormatJson,
    timeoutMs = LLAMA_FETCH_TIMEOUT_MS,
    timeoutMessage = "Tempo esgotado aguardando o Llama (Ollama). Verifique se o Ollama está rodando e se o modelo está instalado.",
  } = options;
  const m = (model || env.LLAMA_MODEL || DEFAULT_OLLAMA_CHAT_MODEL).trim();
  const apiKey = (env.LLAMA_API_KEY || "ollama").trim() || "ollama";
  const url = `${baseV1()}/chat/completions`;

  const buildBody = (withJsonMode) => {
    const body = {
      model: m,
      messages,
      temperature,
    };
    if (withJsonMode) body.response_format = { type: "json_object" };
    return body;
  };

  async function postChat(withJsonMode) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildBody(withJsonMode)),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      return { response, payload };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(timeoutMessage);
      }
      throw err;
    } finally {
      clearTimeout(tid);
    }
  }

  let { response, payload } = await postChat(responseFormatJson);

  if (!response.ok && responseFormatJson) {
    const msg = String(payload?.error?.message || payload?.error || "");
    if (/response_format|json_object|unknown field/i.test(msg)) {
      ({ response, payload } = await postChat(false));
    }
  }

  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      (typeof payload?.error === "string" ? payload.error : null) ||
      `Falha HTTP ${response.status}`;
    const err = new Error(detail);
    err.status = response.status;
    throw err;
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (content == null || String(content).trim() === "") {
    throw new Error("Resposta vazia do modelo");
  }

  const usage = {
    inputTokens: Number(payload?.usage?.prompt_tokens || 0),
    outputTokens: Number(payload?.usage?.completion_tokens || 0),
    totalTokens: Number(payload?.usage?.total_tokens || 0),
  };
  const resolvedModel = payload?.model || m;

  if (!expectJson) {
    return { text: String(content).trim(), usage, model: resolvedModel, rawContent: content };
  }

  const parseResult = parseJsonFromLlmContent(content);
  if (!parseResult.ok) {
    const e = new Error("O modelo retornou JSON inválido");
    e.llmUsage = usage;
    e.llmModel = resolvedModel;
    e.rawContent = parseResult.raw;
    throw e;
  }

  return { parsed: parseResult.parsed, usage, model: resolvedModel, rawContent: content };
}

/**
 * Chat completion com saída JSON (prompt deve exigir só JSON).
 * @param {string} promptUser
 * @param {{ temperature?: number, model?: string, responseFormatJson?: boolean }} [options]
 */
export async function llamaChatCompletionJson(promptUser, options = {}) {
  return llamaChatCompletionFromMessages([{ role: "user", content: promptUser }], {
    ...options,
    responseFormatJson: options.responseFormatJson !== false,
    expectJson: true,
  });
}

/**
 * Chat completion em texto livre (sem JSON).
 * @param {string} promptUser
 * @param {{ temperature?: number, model?: string, timeoutMs?: number }} [options]
 */
export async function llamaChatCompletionText(promptUser, options = {}) {
  return llamaChatCompletionFromMessages([{ role: "user", content: promptUser }], {
    ...options,
    responseFormatJson: false,
    expectJson: false,
  });
}

/**
 * Chat vision com uma ou mais imagens (data URL ou URL HTTP) + texto; saída JSON.
 * @param {string} promptText
 * @param {string[]} imageDataUrls
 * @param {{ temperature?: number, model?: string }} [options]
 */
export async function llamaChatCompletionVisionJson(promptText, imageDataUrls, options = {}) {
  const images = (Array.isArray(imageDataUrls) ? imageDataUrls : [])
    .map((u) => String(u || "").trim())
    .filter(Boolean);
  if (!images.length) {
    throw new Error("Nenhuma imagem para análise visual.");
  }

  const content = [
    { type: "text", text: promptText },
    ...images.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const model = (options.model || env.LLAMA_VISION_MODEL || "llava:7b").trim();

  return llamaChatCompletionFromMessages([{ role: "user", content }], {
    ...options,
    model,
    responseFormatJson: false,
    expectJson: true,
    timeoutMs: LLAMA_VISION_FETCH_TIMEOUT_MS,
    timeoutMessage:
      "Tempo esgotado na análise visual (Ollama). Confira se o modelo de visão está instalado (`ollama pull llava:7b`).",
  });
}
