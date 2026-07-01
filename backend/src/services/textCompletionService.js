import { env } from "../config.js";
import { parseJsonFromLlmContent } from "./llamaJsonParse.js";
import { llamaChatCompletionJson } from "./llamaOpenAiClient.js";
import { replicateChatCompletionJson } from "./replicateTextService.js";

/** @returns {"ollama" | "replicate" | "openai"} */
export function resolveTextProvider() {
  const explicit = String(env.TEXT_PROVIDER || "").trim().toLowerCase();
  if (explicit === "ollama" || explicit === "replicate" || explicit === "openai") {
    return explicit;
  }
  if ((env.REPLICATE_API_TOKEN || "").trim() && env.REPLICATE_ALLOW_BILLING) {
    return "replicate";
  }
  return "ollama";
}

/**
 * Gera JSON via IA de texto (Replicate, Ollama ou OpenAI).
 * @param {string} prompt
 * @param {{ temperature?: number, model?: string, maxTokens?: number }} [options]
 */
export async function chatCompletionJson(prompt, options = {}) {
  const provider = resolveTextProvider();

  if (provider === "replicate") {
    return replicateChatCompletionJson(prompt, options);
  }

  if (provider === "openai") {
    return openaiChatCompletionJson(prompt, options);
  }

  return llamaChatCompletionJson(prompt, options);
}

/**
 * @param {string} prompt
 * @param {{ temperature?: number, model?: string, maxTokens?: number }} [options]
 */
async function openaiChatCompletionJson(prompt, options = {}) {
  const apiKey = (env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY não configurada."), { status: 503 });
  }
  if (!env.OPENAI_ALLOW_BILLING) {
    throw Object.assign(
      new Error("Geração de texto (OpenAI) desligada. Defina OPENAI_ALLOW_BILLING=true."),
      { status: 503 },
    );
  }

  const model = (options.model || env.OPENAI_CHAT_MODEL || "gpt-4o-mini").trim();
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: options.temperature ?? 0.75,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(payload?.error?.message || `OpenAI ${response.status}`));
    }
    const content = String(payload?.choices?.[0]?.message?.content || "").trim();
    if (!content) throw new Error("Resposta vazia do OpenAI");

    const parseResult = parseJsonFromLlmContent(content);
    if (!parseResult.ok) {
      throw new Error("OpenAI retornou JSON inválido");
    }

    return {
      parsed: parseResult.parsed,
      usage: {
        inputTokens: Number(payload?.usage?.prompt_tokens || 0),
        outputTokens: Number(payload?.usage?.completion_tokens || 0),
        totalTokens: Number(payload?.usage?.total_tokens || 0),
      },
      model: payload?.model || model,
      rawContent: content,
    };
  } finally {
    clearTimeout(tid);
  }
}
