import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNodeChatLlmPrompt,
  nodeChatLlmUnavailableFallback,
} from "../../backend/src/services/chatNodeLlmLight.js";

describe("chatNodeLlmLight", () => {
  it("monta prompt com contexto da marca e pergunta", () => {
    const prompt = buildNodeChatLlmPrompt({
      question: "me dá uma ideia criativa",
      history: [{ role: "user", content: "oi" }],
      trainingBlock: "[EMPRESA] nome_fantasia: FYT",
      chat_mode: null,
      nomeFantasia: "FYT",
    });
    assert.match(prompt, /Tuma IA/i);
    assert.match(prompt, /FYT/);
    assert.match(prompt, /me dá uma ideia criativa/);
    assert.match(prompt, /Não mencione RAG/i);
    assert.match(prompt, /Ollama/i);
  });

  it("inclui hint de conversa aberta", () => {
    const prompt = buildNodeChatLlmPrompt({
      question: "como fazer lasanha",
      chat_mode: "conversa_aberta",
      nomeFantasia: "Loja",
    });
    assert.match(prompt, /Conversa natural/i);
    assert.match(prompt, /lasanha/i);
  });

  it("fallback orienta pedido de post quando LLM falha", () => {
    const msg = nodeChatLlmUnavailableFallback("FYT");
    assert.match(msg, /post.*FYT/i);
  });
});
