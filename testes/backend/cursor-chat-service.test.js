import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCursorChatPrompt } from "../../backend/src/services/cursorChatService.js";

describe("cursorChatService", () => {
  it("monta prompt compacto com identidade Tuma", () => {
    const prompt = buildCursorChatPrompt({
      question: "me ajuda com uma ideia?",
      history: [{ role: "user", content: "oi" }],
      nomeFantasia: "FYT",
      chat_mode: null,
    });
    assert.match(prompt, /Tuma IA/i);
    assert.match(prompt, /FYT/);
    assert.match(prompt, /2 a 4 frases/i);
    assert.match(prompt, /Não mencione Cursor/i);
    assert.match(prompt, /me ajuda com uma ideia/);
  });

  it("comprime saudação no histórico do prompt Cursor", () => {
    const prompt = buildCursorChatPrompt({
      question: "me fala um pouco sobre o neymar",
      history: [
        { role: "user", content: "oi" },
        {
          role: "assistant",
          content: "Oi! Sou o Tuma IA, assistente de criação de artes da FYT. O que você precisa hoje?",
        },
      ],
      nomeFantasia: "FYT",
      chat_mode: "conversa_aberta",
    });
    assert.match(prompt, /Usuário: oi/i);
    assert.doesNotMatch(prompt, /Tuma:.*precisa hoje/i);
    assert.match(prompt, /neymar/i);
    assert.match(prompt, /Não repita saudação/i);
  });
});
