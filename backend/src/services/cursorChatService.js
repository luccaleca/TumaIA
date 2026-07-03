/**
 * Cursor Agent (cloud) para conversa — sessão reutilizada para reduzir latência.
 */

import { Agent, CursorAgentError } from "@cursor/sdk";
import { env } from "../config.js";
import { buildConversaNaturalPromptHint } from "./chatConversaNatural.js";

const SESSION_TTL_MS_DEFAULT = 25 * 60 * 1000;
const MAX_WARM_SESSIONS = 8;

/** @type {Map<string, { agent: import("@cursor/sdk").SDKAgent, warm: boolean, lastUsed: number }>} */
const warmSessions = new Map();

function resolveApiKey() {
  const apiKey = String(env.CURSOR_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY não configurado no backend/.env");
  }
  return apiKey;
}

function resolveModelId() {
  return String(env.CURSOR_CHAT_MODEL || "composer-2.5-fast").trim();
}

function resolveTimeoutMs() {
  return Number(env.CURSOR_CHAT_TIMEOUT_MS) || 300_000;
}

function sessionTtlMs() {
  const n = Number(env.CURSOR_CHAT_SESSION_TTL_MS);
  return Number.isFinite(n) && n >= 60_000 ? n : SESSION_TTL_MS_DEFAULT;
}

/**
 * @param {{ agent?: import("@cursor/sdk").SDKAgent }} entry
 */
async function disposeSessionEntry(entry) {
  if (!entry?.agent) return;
  try {
    if (typeof entry.agent[Symbol.asyncDispose] === "function") {
      await entry.agent[Symbol.asyncDispose]();
    } else if (typeof entry.agent.close === "function") {
      entry.agent.close();
    }
  } catch {
    /* ignore */
  }
}

function pruneWarmSessions() {
  const now = Date.now();
  const ttl = sessionTtlMs();
  for (const [key, entry] of warmSessions) {
    if (now - entry.lastUsed > ttl) {
      void disposeSessionEntry(entry);
      warmSessions.delete(key);
    }
  }
  while (warmSessions.size > MAX_WARM_SESSIONS) {
    const oldest = [...warmSessions.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
    if (!oldest) break;
    void disposeSessionEntry(oldest[1]);
    warmSessions.delete(oldest[0]);
  }
}

const RE_IDENTITY_GREETING =
  /^o[ií]!?\s+sou\s+o\s+tuma\s+ia\b/i;

const RE_GREETING_TAIL_ONLY = /^o\s+que\s+voc[eê]\s+precisa\s+hoje\??$/i;

/**
 * @param {string} content
 */
function compressHistoryLine(content, role) {
  const t = String(content || "").trim();
  if (!t) return "";
  if (role === "assistant" && RE_IDENTITY_GREETING.test(t) && /precisa\s+hoje\??$/i.test(t)) {
    return "[já cumprimentou o usuário]";
  }
  return t.length > 240 ? `${t.slice(0, 237)}…` : t;
}

/**
 * Só mensagens do usuário — evita o Cursor repetir a saudação da Tuma.
 * @param {Array<{ role: string, content: string }>} history
 */
function formatHistoryForCursor(history) {
  const users = (Array.isArray(history) ? history : [])
    .filter((h) => h?.role === "user")
    .slice(-3)
    .map((h) => {
      const line = compressHistoryLine(h.content, "user");
      return line ? `Usuário: ${line}` : null;
    })
    .filter(Boolean);
  return users.join("\n");
}

/**
 * Prompt curto na 1ª mensagem da sessão (identidade + histórico mínimo).
 * @param {{
 *   question: string,
 *   history?: Array<{ role: string, content: string }>,
 *   nomeFantasia?: string | null,
 *   chat_mode?: string | null,
 * }} input
 */
export function buildCursorChatPrompt(input) {
  const question = String(input.question || "").trim();
  const nomeFantasia = String(input.nomeFantasia || "").trim() || null;
  const chatMode = String(input.chat_mode || "").trim() || null;
  const emp = nomeFantasia ? ` da ${nomeFantasia}` : "";
  const hist = formatHistoryForCursor(input.history);

  const lines = [
    "Você é a Tuma IA — assistente de marketing e criação de posts para Instagram.",
    `Responda em português do Brasil, tom de colega, em 2 a 4 frases curtas.`,
    `Não invente produtos${emp}. Não mencione Cursor, mouse, APIs, Ollama ou ferramentas internas.`,
    "Responda DIRETO o que o usuário perguntou. Não repita saudação nem «O que você precisa hoje?».",
    "Se pedirem post ou arte, oriente a descrever produto e formato.",
  ];

  if (chatMode === "conversa_aberta") {
    lines.push(buildConversaNaturalPromptHint(nomeFantasia));
  } else if (chatMode === "identidade") {
    lines.push("Explique o que a Tuma faz de forma simples e acolhedora.");
  }

  const parts = [lines.join("\n")];
  if (hist) parts.push(`Histórico recente:\n${hist}`);
  parts.push(`Usuário: ${question}`);
  return parts.join("\n\n");
}

function buildAgentOptions() {
  return {
    apiKey: resolveApiKey(),
    model: { id: resolveModelId() },
    cloud: { skipReviewerRequest: true },
  };
}

/**
 * @param {import("@cursor/sdk").Run} run
 */
async function waitForRun(run) {
  const timeoutMs = resolveTimeoutMs();
  let timer;
  try {
    return await Promise.race([
      run.wait(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Tempo esgotado aguardando o Cursor Agent.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {import("@cursor/sdk").RunResult} result
 * @param {string} modelId
 * @param {"session_reuse" | "session_new" | "one_shot"} mode
 */
function normalizeRunResult(result, modelId, mode) {
  if (result.status === "error" || result.status === "cancelled") {
    throw new Error(String(result.result || `Cursor Agent: ${result.status}`));
  }
  const text = String(result.result || "").trim();
  if (!text) {
    throw new Error("Cursor Agent retornou resposta vazia");
  }
  return {
    ok: true,
    text,
    model: modelId,
    durationMs: result.durationMs,
    provider: "cursor",
    cursor_session_mode: mode,
  };
}

/**
 * @param {string | null | undefined} sessionKey
 * @param {import("@cursor/sdk").SDKAgent} agent
 */
function storeWarmSession(sessionKey, agent) {
  const key = String(sessionKey || "").trim();
  if (!key) return;
  warmSessions.set(key, { agent, warm: true, lastUsed: Date.now() });
}

/**
 * @param {{
 *   question: string,
 *   history?: Array<{ role: string, content: string }>,
 *   sessionKey?: string | null,
 *   nomeFantasia?: string | null,
 *   chat_mode?: string | null,
 * }} input
 */
export async function promptCursorChat(input) {
  const question = String(input.question || "").trim();
  if (!question) {
    throw new Error("Mensagem vazia");
  }

  pruneWarmSessions();

  const sessionKey = String(input.sessionKey || "").trim();
  const modelId = resolveModelId();
  const existing = sessionKey ? warmSessions.get(sessionKey) : null;

  if (existing && Date.now() - existing.lastUsed <= sessionTtlMs()) {
    try {
      const run = await existing.agent.send(question);
      const result = await waitForRun(run);
      existing.lastUsed = Date.now();
      return normalizeRunResult(result, modelId, "session_reuse");
    } catch (err) {
      warmSessions.delete(sessionKey);
      await disposeSessionEntry(existing);
      if (!(err instanceof CursorAgentError) || !err.isRetryable) {
        throw err;
      }
    }
  } else if (existing) {
    warmSessions.delete(sessionKey);
    await disposeSessionEntry(existing);
  }

  const firstMessage = buildCursorChatPrompt({
    question,
    history: input.history,
    nomeFantasia: input.nomeFantasia,
    chat_mode: input.chat_mode,
  });

  const opts = buildAgentOptions();
  const agent = await Agent.create(opts);
  try {
    const run = await agent.send(firstMessage);
    const result = await waitForRun(run);

    if (sessionKey) {
      storeWarmSession(sessionKey, agent);
      return normalizeRunResult(result, modelId, "session_new");
    }

    await disposeSessionEntry({ agent });
    return normalizeRunResult(result, modelId, "one_shot");
  } catch (err) {
    await disposeSessionEntry({ agent });
    if (err instanceof CursorAgentError) {
      const e = new Error(err.message || "Falha ao chamar Cursor Agent");
      e.isRetryable = err.isRetryable;
      throw e;
    }
    throw err;
  }
}

/** @deprecated use promptCursorChat */
export async function promptCursorChatRaw(userMessage) {
  return promptCursorChat({ question: userMessage });
}
