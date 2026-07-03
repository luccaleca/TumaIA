/**
 * Camada 3 (fast path): LLM via Ollama no Node — sem worker Python / RAG.
 */

import { env } from "../config.js";
import { DEFAULT_OLLAMA_CHAT_MODEL } from "../ollamaDefaults.js";
import { buildConversaNaturalPromptHint } from "./chatConversaNatural.js";
import { llamaChatCompletionText } from "./llamaOpenAiClient.js";
import { promptCursorChat } from "./cursorChatService.js";

/**
 * @param {Array<{ role: string, content: string }>} history
 */
function formatHistoryForPrompt(history) {
  const tail = (Array.isArray(history) ? history : []).slice(-4);
  if (!tail.length) return "";
  return tail.map((h) => `${h.role === "assistant" ? "Tuma" : "Usuário"}: ${h.content}`).join("\n");
}

/**
 * @param {{
 *   question: string,
 *   history?: Array<{ role: string, content: string }>,
 *   trainingBlock?: string,
 *   chat_mode?: string | null,
 *   nomeFantasia?: string | null,
 * }} input
 */
export function buildNodeChatLlmPrompt(input) {
  const question = String(input.question || "").trim();
  const nomeFantasia = String(input.nomeFantasia || "").trim() || null;
  const chatMode = String(input.chat_mode || "").trim() || null;
  const trainingBlock = String(input.trainingBlock || "").trim();
  const hist = formatHistoryForPrompt(input.history);

  const emp = nomeFantasia ? ` da ${nomeFantasia}` : "";
  const lines = [
    "Você é o Tuma IA — assistente de marketing e criação de posts para Instagram.",
    "Português do Brasil, tom de colega, respostas curtas (2 a 5 frases).",
    `Não invente produtos${emp}; use só o contexto abaixo quando existir.`,
    "Não mencione RAG, embeddings, Chroma, Ollama, Supabase ou APIs internas.",
    "Se pedirem post ou arte, oriente a descrever produto e formato — você monta o resumo para confirmar.",
    "PROIBIDO: «não entendi», «isso foge do escopo», listar produtos sem pedido.",
  ];

  if (chatMode === "conversa_aberta") {
    lines.push(buildConversaNaturalPromptHint(nomeFantasia));
  } else if (chatMode === "identidade") {
    lines.push(
      "[Modo identidade] Responda sobre o que o Tuma faz, capacidades e temas leves do perfil da marca.",
    );
  } else if (trainingBlock) {
    lines.push(
      "[Contexto da empresa] Use os dados abaixo com fidelidade; se não souber, diga com honestidade.",
    );
  }

  const parts = [lines.join("\n")];
  if (trainingBlock) parts.push(trainingBlock);
  if (hist) parts.push(`Histórico recente:\n${hist}`);
  parts.push(`Usuário: ${question}`);
  return parts.join("\n\n");
}

/**
 * @param {string | null} nomeFantasia
 */
export function nodeChatLlmUnavailableFallback(nomeFantasia = null) {
  const emp = nomeFantasia ? ` da ${nomeFantasia}` : "";
  if (env.CHAT_LLM_PROVIDER === "cursor") {
    return (
      `Não consegui falar com o Cursor Agent agora (confira CURSOR_API_KEY no .env). ` +
      `Se quiser um post${emp}, descreva o produto e o que imagina na arte.`
    );
  }
  return (
    `Não consegui falar com a IA agora (confira se o Ollama está ligado). ` +
    `Se quiser um post${emp}, descreva o produto e o que imagina na arte — eu monto o resumo pra você confirmar.`
  );
}

function resolveFastChatModel() {
  return (
    String(env.OLLAMA_FAST_CHAT_MODEL || "").trim() ||
    String(env.LLAMA_MODEL || "").trim() ||
    DEFAULT_OLLAMA_CHAT_MODEL
  );
}

/**
 * @param {{
 *   question: string,
 *   history?: Array<{ role: string, content: string }>,
 *   trainingBlock?: string,
 *   chat_mode?: string | null,
 *   nomeFantasia?: string | null,
 *   sessionKey?: string | null,
 * }} input
 */
export async function runNodeChatLlm(input) {
  const chatMode = String(input.chat_mode || "").trim() || null;

  if (env.CHAT_LLM_PROVIDER === "cursor") {
    const t0 = Date.now();
    try {
      const out = await promptCursorChat({
        question: input.question,
        history: input.history,
        sessionKey: input.sessionKey,
        nomeFantasia: input.nomeFantasia,
        chat_mode: chatMode,
      });
      const elapsedMs = Date.now() - t0;
      if (elapsedMs > 5_000) {
        const mode = out.cursor_session_mode === "session_reuse" ? "reuse" : "nova sessão";
        console.info(`[ia/chat] Cursor Agent (${mode}) em ${Math.round(elapsedMs / 1000)}s`);
      }
      return {
        ok: true,
        text: out.text,
        model: out.model,
        provider: "cursor",
        cursor_session_mode: out.cursor_session_mode,
      };
    } catch (err) {
      return { ok: false, error: err, provider: "cursor" };
    }
  }

  const prompt = buildNodeChatLlmPrompt(input);
  const timeoutMs =
    chatMode === "conversa_aberta"
      ? Number(env.CHAT_NATURAL_REQUEST_TIMEOUT_MS) || 90_000
      : 120_000;

  try {
    const out = await llamaChatCompletionText(prompt, {
      model: resolveFastChatModel(),
      temperature: chatMode === "conversa_aberta" ? 0.5 : 0.38,
      timeoutMs,
      timeoutMessage:
        "Tempo esgotado aguardando o Ollama. Confira LLAMA_BASE_URL e o modelo (ex.: ollama pull qwen2.5:3b).",
    });
    const text = String(out.text || "").trim();
    if (!text) {
      return { ok: false, error: new Error("Resposta vazia do modelo") };
    }
    return { ok: true, text, model: out.model };
  } catch (err) {
    return { ok: false, error: err };
  }
}
