import { env } from "../config.js";
import { parseJsonFromLlmContent } from "./llamaJsonParse.js";
import { createModelPrediction, waitForPrediction } from "./replicateClient.js";

const DEFAULT_TEXT_MODEL = "meta/meta-llama-3-8b-instruct";

function parseModelRef(raw) {
  const s = String(raw || DEFAULT_TEXT_MODEL).trim();
  const slash = s.indexOf("/");
  if (slash <= 0) return { owner: "meta", name: s };
  return { owner: s.slice(0, slash), name: s.slice(slash + 1) };
}

function normalizeTextOutput(output) {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.map((chunk) => String(chunk ?? "")).join("");
  return String(output ?? "");
}

/**
 * Chat completion com saída JSON via Replicate (Llama, etc.).
 * @param {string} prompt
 * @param {{ temperature?: number, maxTokens?: number, model?: string }} [options]
 */
export async function replicateChatCompletionJson(prompt, options = {}) {
  const token = (env.REPLICATE_API_TOKEN || "").trim();
  if (!token) {
    throw Object.assign(new Error("REPLICATE_API_TOKEN não configurada."), { status: 503 });
  }
  if (!env.REPLICATE_ALLOW_BILLING) {
    throw Object.assign(
      new Error("Geração de texto (Replicate) desligada. Defina REPLICATE_ALLOW_BILLING=true."),
      { status: 503 },
    );
  }

  const { owner, name } = parseModelRef(options.model || env.REPLICATE_TEXT_MODEL || DEFAULT_TEXT_MODEL);
  const prediction = await createModelPrediction(token, owner, name, {
    prompt: String(prompt),
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.75,
  });

  const getUrl = prediction?.urls?.get;
  if (!getUrl) {
    throw new Error("Replicate: prediction sem urls.get");
  }

  const done = await waitForPrediction(token, getUrl, { maxWaitMs: 120_000 });
  const content = normalizeTextOutput(done.output).trim();
  if (!content) {
    throw new Error("Resposta vazia do modelo na Replicate");
  }

  const parseResult = parseJsonFromLlmContent(content);
  if (!parseResult.ok) {
    const e = new Error("O modelo retornou JSON inválido");
    e.llmModel = `${owner}/${name}`;
    e.rawContent = parseResult.raw;
    throw e;
  }

  return { parsed: parseResult.parsed, usage: null, model: `${owner}/${name}`, rawContent: content };
}
