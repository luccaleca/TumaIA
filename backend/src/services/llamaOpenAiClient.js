import { env } from "../config.js";

/** Base OpenAI-compatível (ex.: Ollama `http://127.0.0.1:11434/v1`). */
function baseV1() {
  const raw = (env.LLAMA_BASE_URL || "http://127.0.0.1:11434/v1").trim().replace(/\/+$/, "");
  if (!raw) return "http://127.0.0.1:11434/v1";
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

function extractJsonFromContent(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(s);
  if (fence) return fence[1].trim();
  return s;
}

/**
 * Chat completion com saída JSON (prompt deve exigir só JSON).
 * @param {string} promptUser
 * @param {{ temperature?: number, model?: string, responseFormatJson?: boolean }} [options]
 */
export async function llamaChatCompletionJson(promptUser, options = {}) {
  const { temperature = 0.35, model, responseFormatJson = true } = options;
  const m = (model || env.LLAMA_MODEL || "llama3.2:3b").trim();
  const apiKey = (env.LLAMA_API_KEY || "ollama").trim() || "ollama";
  const url = `${baseV1()}/chat/completions`;

  const buildBody = (withJsonMode) => {
    const body = {
      model: m,
      messages: [{ role: "user", content: promptUser }],
      temperature,
    };
    if (withJsonMode) body.response_format = { type: "json_object" };
    return body;
  };

  let response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildBody(responseFormatJson)),
  });

  let payload = await response.json().catch(() => ({}));

  if (!response.ok && responseFormatJson) {
    const msg = String(payload?.error?.message || payload?.error || "");
    if (/response_format|json_object|unknown field/i.test(msg)) {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildBody(false)),
      });
      payload = await response.json().catch(() => ({}));
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

  const extracted = extractJsonFromContent(content);
  if (extracted == null) {
    const e = new Error("O modelo retornou JSON inválido");
    e.llmUsage = usage;
    e.llmModel = resolvedModel;
    throw e;
  }

  let parsed;
  try {
    parsed = JSON.parse(extracted);
  } catch {
    const e = new Error("O modelo retornou JSON inválido");
    e.llmUsage = usage;
    e.llmModel = resolvedModel;
    throw e;
  }

  return { parsed, usage, model: resolvedModel };
}
