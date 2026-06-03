import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeChatTurn } from "../../backend/src/services/chatTurnIntent.js";
import {
  tryChatOutOfScopeResponse,
  formatBrasiliaDateAnswer,
  getBrasiliaDateParts,
  isDateTimeQuestion,
} from "../../backend/src/services/chatOutOfScopeResponse.js";
import { sanitizeChatAnswer } from "../../backend/src/services/chatAnswerSanitizer.js";

describe("chatOutOfScope — data e hora", () => {
  it("detecta perguntas de data informal", () => {
    assert.equal(isDateTimeQuestion("que dia é hoje"), true);
    assert.equal(isDateTimeQuestion("quero o dia da semana mes e ano"), true);
    assert.equal(isDateTimeQuestion("quais produtos temos"), false);
  });

  it("resposta usa weekday real de Brasília", () => {
    const fixed = new Date("2026-06-01T15:00:00-03:00");
    const p = getBrasiliaDateParts(fixed);
    assert.match(p.weekday, /segunda-feira/i);
    const ans = formatBrasiliaDateAnswer(fixed);
    assert.match(ans, /segunda-feira/i);
    assert.match(ans, /junho de 2026/i);
    assert.doesNotMatch(ans, /marketing/i);
  });

  it("que dia é hoje → rota out_of_scope sem pitch", () => {
    const t = analyzeChatTurn("que dia é hoje", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "out_of_scope");
    assert.match(t.outOfScopeAnswer || "", /Hoje é/i);
    assert.doesNotMatch(t.outOfScopeAnswer || "", /marketing visual/i);
  });

  it("quero dia semana mês e ano → data completa", () => {
    const ans = tryChatOutOfScopeResponse("quero o dia da semana mes e ano", "FYT");
    assert.match(ans || "", /Hoje é/i);
    assert.match(ans || "", /de \w+ de \d{4}/i);
    assert.doesNotMatch(ans || "", /sexta-feira.*não mencionado/i);
  });

  it("sanitizer remove pitch de marketing em resposta LLM suja", () => {
    const out = sanitizeChatAnswer({
      answer:
        "Hoje é sexta-feira. Como posso ajudar você com o marketing visual da FYT?",
      question: "que dia é hoje",
      history: [],
      nomeFantasia: "FYT",
    });
    assert.doesNotMatch(out, /marketing visual/i);
    assert.match(out, /Hoje é/i);
  });
});
