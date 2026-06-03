import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeChatAnswer } from "../../backend/src/services/chatAnswerSanitizer.js";
import { tryChatIdentityResponse } from "../../backend/src/services/chatIdentityResponse.js";

describe("chatAnswerSanitizer", () => {
  const history = [
    { role: "user", content: "oi" },
    {
      role: "assistant",
      content: "Oi! Sou o Tuma IA, assistente de criação de artes da FYT. O que você precisa hoje?",
    },
  ];

  it("remove saudação repetida quando já há histórico", () => {
    const out = sanitizeChatAnswer({
      answer: "Olá! Temos whey de chocolate e Monster no acervo.",
      question: "quais produtos temos?",
      history,
      nomeFantasia: "FYT",
    });
    assert.doesNotMatch(out, /^ol[aá]/i);
    assert.match(out, /whey|Monster/i);
  });

  it("remove meta-linguagem de sistema", () => {
    const out = sanitizeChatAnswer({
      answer:
        "Sou uma IA que interpreta a empresa em sessão. Temos whey de chocolate.",
      question: "quais produtos?",
      history: [],
      nomeFantasia: "FYT",
    });
    assert.doesNotMatch(out, /empresa em sess/i);
    assert.match(out, /whey/i);
  });

  it("remove pitch de post quando não pediram arte", () => {
    const out = sanitizeChatAnswer({
      answer:
        "Temos Monster. Quer montar um post para o Instagram com ele?",
      question: "tem monster?",
      history: [],
      nomeFantasia: "FYT",
    });
    assert.match(out, /Monster/i);
    assert.doesNotMatch(out, /post.*instagram/i);
  });

  it("identidade + texto genérico → resposta de identidade", () => {
    const out = sanitizeChatAnswer({
      answer:
        "Nossos produtos incluem suplementos de musculação e hidratação.",
      question: "qual seu nome",
      history: [],
      nomeFantasia: "FYT",
    });
    assert.match(out, /Tuma IA/i);
    assert.doesNotMatch(out, /musculação/i);
  });

  it("remove falsa consulta ao banco", () => {
    const out = sanitizeChatAnswer({
      answer: "Consultei o banco de dados. Temos whey de chocolate.",
      question: "quais produtos?",
      history: [],
      nomeFantasia: "FYT",
    });
    assert.doesNotMatch(out, /consultei|banco/i);
    assert.match(out, /whey/i);
  });

  it("remove menu robótico e abertura bajuladora", () => {
    const out = sanitizeChatAnswer({
      answer:
        "Com certeza! Opção 1: listar produtos. Opção 2: gerar post. Temos Monster.",
      question: "tem monster?",
      history: [],
      nomeFantasia: "FYT",
    });
    assert.doesNotMatch(out, /op[cç][aã]o\s*1|com certeza/i);
    assert.match(out, /Monster/i);
  });

  it("remove dica genérica de hashtags", () => {
    const out = sanitizeChatAnswer({
      answer: "Temos whey. Use hashtags para engajamento orgânico.",
      question: "tem whey?",
      history: [],
      nomeFantasia: "FYT",
    });
    assert.match(out, /whey/i);
    assert.doesNotMatch(out, /hashtag/i);
  });

  it("pergunta de utilidade após oi → resposta rica, sem «mudar o foco»", () => {
    const history = [
      { role: "user", content: "oi" },
      {
        role: "assistant",
        content: "Oi! Sou o Tuma IA, assistente de criação de artes da FYT. O que você precisa hoje?",
      },
    ];
    const out = sanitizeChatAnswer({
      answer:
        "Entendi — vou mudar o foco. Eu sou o Tuma IA, assistente de criação de artes para a FYT.",
      question: "para oq vc serve",
      history,
      nomeFantasia: "FYT",
    });
    assert.doesNotMatch(out, /mudar\s+o\s+foco/i);
    assert.match(out, /M[ií]dias|Instagram|marketing/i);
    assert.doesNotMatch(out, /^oi!/i);
  });

  it("detecta repetição quase igual sem frase robótica", () => {
    const prev =
      "Temos whey de chocolate, Monster e creatina no acervo da FYT.";
    const out = sanitizeChatAnswer({
      answer: prev,
      question: "e sobre a empresa?",
      history: [
        { role: "user", content: "quais produtos?" },
        { role: "assistant", content: prev },
      ],
      nomeFantasia: "FYT",
    });
    assert.notEqual(out, prev);
    assert.doesNotMatch(out, /mudar\s+o\s+foco/i);
  });
});

describe("chatIdentityResponse — capacidade", () => {
  it("você consegue me ajudar → explica sem abrir arte", () => {
    const ans = tryChatIdentityResponse("você consegue me ajudar?", "FYT");
    assert.match(ans || "", /Consigo/i);
    assert.doesNotMatch(ans || "", /resumo|pr[eé]via/i);
  });
});
