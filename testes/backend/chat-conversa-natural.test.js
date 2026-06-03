import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeChatTurn } from "../../backend/src/services/chatTurnIntent.js";
import {
  tryChatConversaNaturalResponse,
  isConversaNaturalQuestion,
} from "../../backend/src/services/chatConversaNatural.js";

describe("chatConversaNatural", () => {
  it("detecta receita de batata", () => {
    assert.equal(isConversaNaturalQuestion("como cozinhar batata"), true);
    assert.equal(isConversaNaturalQuestion("quais produtos temos"), false);
  });

  it("responde batata com dica de cozinho, não «foge do escopo»", () => {
    const ans = tryChatConversaNaturalResponse("como cozinhar batata", "FYT");
    assert.match(ans || "", /batata|cozinhe|forno|água/i);
    assert.doesNotMatch(ans || "", /foge|n[aã]o\s+entendi|n[aã]o\s+captei/i);
  });

  it("rota conversa_natural antes do LLM", () => {
    const t = analyzeChatTurn("receita de arroz simples", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "conversa_natural");
    assert.match(t.conversaNaturalAnswer || "", /arroz/i);
  });

  it("pergunta de produto não vai para conversa natural", () => {
    assert.equal(isConversaNaturalQuestion("monta post do whey"), false);
    const t = analyzeChatTurn("monta post do whey", [], { nomeFantasia: "FYT" });
    assert.notEqual(t.route, "conversa_natural");
  });
});
