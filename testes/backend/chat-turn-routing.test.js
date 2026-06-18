import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeChatTurn, extractChatTopics } from "../../backend/src/services/chatTurnIntent.js";
import { classifyChatAcervoIntent } from "../../backend/src/services/chatIntent.js";
import { guardChatProductAnswer } from "../../backend/src/services/chatProductGuard.js";
import { tryChatIdentityResponse } from "../../backend/src/services/chatIdentityResponse.js";
import { tryChatCompositeResponse, shouldUseCompositeResponse } from "../../backend/src/services/chatCompositeResponse.js";
import { filterDisplayProductLabels, isArtifactProductLabel } from "../../backend/src/services/chatAcervoResponse.js";
import { formatContextosListAnswer } from "../../backend/src/services/chatContextosResponse.js";
import { buildChatTrainingPromptBlock } from "../../backend/src/services/chatPromptBundle.js";

describe("chat routing — identidade vs acervo", () => {
  const fy = { nomeFantasia: "FYT" };

  it("qual seu nome → identidade, não acervo", () => {
    const t = analyzeChatTurn("qual seu nome", [], fy);
    assert.equal(t.route, "identity");
    assert.match(t.identityAnswer || "", /Tuma IA/i);
    assert.equal(classifyChatAcervoIntent("qual seu nome").kind, "NONE");
  });

  it("oi → saudação com nome da empresa", () => {
    const ans = tryChatIdentityResponse("oi", "FYT");
    assert.match(ans || "", /FYT/);
    assert.doesNotMatch(ans || "", /acervo|produtos:/i);
  });

  it("quais produtos temos → acervo", () => {
    const t = analyzeChatTurn("quais produtos temos?", [], fy);
    assert.equal(t.route, "acervo");
    assert.equal(t.acervo?.kind, "LISTAR_PRODUTOS");
  });

  it("tuma, que produtos temos disponiveis → acervo (não identity_llm)", () => {
    const t = analyzeChatTurn("tuma, que produtos temos disponiveis", [], fy);
    assert.equal(t.route, "acervo");
    assert.equal(t.acervo?.kind, "LISTAR_PRODUTOS");
    assert.equal(t.chat_mode, null);
  });

  it("quero saber oq temos de produtos → listar, não «de produtos»", () => {
    assert.equal(classifyChatAcervoIntent("quero saber oq temos de produtos").kind, "LISTAR_PRODUTOS");
    const t = analyzeChatTurn("quero saber oq temos de produtos", [], fy);
    assert.equal(t.route, "acervo");
    assert.equal(t.acervo?.kind, "LISTAR_PRODUTOS");
  });

  it("guard não troca resposta de identidade por lista", () => {
    const llm =
      "Olá! Nossos produtos incluem suplementos de musculação e hidratação.";
    const rows = [{ tipo_midia: "imagem", nome_exibicao: "whey de chocolate" }];
    const out = guardChatProductAnswer(llm, rows, "FYT", { userQuestion: "qual seu nome" });
    assert.equal(out, llm);
  });

  it("guard corrige lista genérica quando pedem produtos", () => {
    const llm = "Temos suplementos de musculação e hidratação.";
    const rows = [{ tipo_midia: "imagem", nome_exibicao: "whey de chocolate" }];
    const out = guardChatProductAnswer(llm, rows, "FYT", {
      userQuestion: "quais produtos temos?",
    });
    assert.match(out, /whey de chocolate/);
    assert.doesNotMatch(out, /musculação/i);
  });
});

describe("chat routing — composto e treino", () => {
  it("oi quem é vc e como funciona → composite", () => {
    const q = "oi, quem é vc e como funciona?";
    assert.equal(shouldUseCompositeResponse(q), true);
    const topics = extractChatTopics(q);
    assert.ok(topics.includes("IDENTIDADE_QUEM"));
    assert.ok(topics.includes("COMO_FUNCIONA"));
    const t = analyzeChatTurn(q, [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "composite");
  });

  it("composite monta várias respostas", async () => {
    const answer = await tryChatCompositeResponse({
      question: "oi, quem é vc e como funciona?",
      facts: {
        nomeFantasia: "FYT",
        empresa: { nome_fantasia: "FYT", segmento: "Suplementos" },
        contextos: [],
        acervo: { midias: [], nomeFantasia: "FYT" },
      },
    });
    assert.match(answer || "", /Tuma IA/i);
    assert.match(answer || "", /FYT/);
    assert.match(answer || "", /painel|pr[eé]via|M[ií]dias/i);
  });

  it("filtra rótulos de teste na listagem", () => {
    assert.equal(isArtifactProductLabel("1779763582018 fyt foto teste"), true);
    assert.equal(isArtifactProductLabel("whey de chocolate"), false);
    const out = filterDisplayProductLabels([
      "1779763582018 fyt foto teste",
      "whey de chocolate",
      "monster",
    ]);
    assert.deepEqual(out, ["whey de chocolate", "monster"]);
  });

  it("prompt de treino inclui empresa e acervo", () => {
    const block = buildChatTrainingPromptBlock({
      empresa: { nome_fantasia: "FYT", segmento: "Fitness" },
      contextos: [{ nome: "Black Friday", descricao: "Promo nov/dez" }],
      acervoLabels: ["whey de chocolate", "monster"],
      nomeFantasia: "FYT",
    });
    assert.match(block, /FYT/);
    assert.match(block, /whey de chocolate/);
    assert.match(block, /Black Friday/);
    assert.match(block, /ACERVO DE PRODUTOS/);
    assert.match(block, /CHECKLIST ANTI-ERRO LLM/);
  });

  it("sobre a empresa → rota empresa", () => {
    const t = analyzeChatTurn("fala sobre a empresa", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "empresa");
  });

  it("modelos de post ativos → rota contextos (follow-up após acervo)", () => {
    const history = [
      { role: "user", content: "quais produtos temos?" },
      {
        role: "assistant",
        content: "No acervo da FYT temos 18 produtos:\n\n• whey\n\nQuer montar post de algum deles?",
      },
    ];
    const t = analyzeChatTurn("e os modelos de post, quais temos ativos?", history, {
      nomeFantasia: "FYT",
    });
    assert.equal(t.route, "contextos");
    assert.ok(t.topics.includes("CONTEXTOS"));
    const ans = formatContextosListAnswer([
      { nome: "Promoção", descricao: "Oferta" },
      { nome: "Lançamento", descricao: "Novidade" },
    ]);
    assert.match(ans, /modelos de post ativos/i);
    assert.match(ans, /Promoção/);
    assert.match(ans, /Lançamento/);
  });

  it("não era isso só queria nome → identidade", () => {
    const t = analyzeChatTurn("não era isso só queria seu nome", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "identity");
    assert.match(t.identityAnswer || "", /Tuma IA/i);
    assert.doesNotMatch(t.identityAnswer || "", /produtos/i);
  });

  it("bom dia → saudação", () => {
    const ans = tryChatIdentityResponse("bom dia", "FYT");
    assert.match(ans || "", /Bom dia|Tuma/i);
    assert.match(ans || "", /FYT/);
  });

  it("como faço pra pedir um post → capacidade sem arte", () => {
    const ans = tryChatIdentityResponse("como faço pra pedir um post", "FYT");
    assert.match(ans || "", /monta|resumo|painel/i);
  });

  it("em qual empresa estou → identidade com nome da empresa", () => {
    const t = analyzeChatTurn("em qual empresa estou?", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "identity");
    assert.match(t.identityAnswer || "", /FYT/);
    assert.match(t.identityAnswer || "", /workspace/i);
  });

  it("para oq vc serve → utilidade, não repetir cumprimento", () => {
    const t = analyzeChatTurn("para oq vc serve", [{ role: "user", content: "oi" }, { role: "assistant", content: "Oi! Sou o Tuma IA da FYT." }], { nomeFantasia: "FYT" });
    assert.equal(t.route, "identity");
    const ans = t.identityAnswer || "";
    assert.match(ans, /M[ií]dias|Instagram|marketing/i);
    assert.doesNotMatch(ans, /mudar\s+o\s+foco/i);
    assert.doesNotMatch(ans, /^oi!/i);
  });

  it("pra que vc serve → rota identidade", () => {
    const ans = tryChatIdentityResponse("pra que vc serve", "FYT");
    assert.match(ans || "", /Sirvo|Ajudo/i);
    assert.match(ans || "", /FYT/);
  });

  it("o que é vc → identidade, não LLM", () => {
    const t = analyzeChatTurn("o que é vc", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "identity");
    assert.match(t.identityAnswer || "", /Tuma IA/i);
  });

  it("por quem vc foi criado → Diego Suhai, sem pitch FYT", () => {
    const t = analyzeChatTurn("por quem vc foi criado", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "identity");
    assert.match(t.identityAnswer || "", /Diego\s+Suhai/i);
    assert.doesNotMatch(t.identityAnswer || "", /como posso ajudar hoje/i);
  });

  it("vc foi criado por quem → criador Diego", () => {
    const t = analyzeChatTurn("vc foi criado por quem", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "identity");
    assert.match(t.identityAnswer || "", /Diego\s+Suhai/i);
  });

  it("quem é teu pai → origem sem listar produtos", () => {
    const t = analyzeChatTurn("quem é teu pai", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "identity");
    assert.match(t.identityAnswer || "", /pai|Diego/i);
    assert.doesNotMatch(t.identityAnswer || "", /produtos:/i);
  });

  it("vc nasceu de onde → origem projeto TumaIA", () => {
    const t = analyzeChatTurn("vc nasceu de onde", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "identity");
    assert.match(t.identityAnswer || "", /Diego|TumaIA|nascer/i);
  });

  it("quais produtos temos → acervo, não identidade", () => {
    const t = analyzeChatTurn("quais produtos temos no acervo", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "acervo");
    assert.notEqual(t.chat_mode, "identidade");
  });

  it("vc me ama → perfil geral emoção, sem acervo", () => {
    const t = analyzeChatTurn("vc me ama", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "identity");
    assert.match(t.identityAnswer || "", /n[aã]o sinto|IA/i);
    assert.equal(t.perfilGeralTheme, "EMOCAO_RELACAO");
  });

  it("qual modelo você usa → perfil geral tecnologia", () => {
    const t = analyzeChatTurn("qual modelo você usa", [], { nomeFantasia: "FYT" });
    assert.ok(t.route === "identity" || t.route === "identity_llm");
    assert.equal(t.chat_mode, "identidade");
    assert.equal(t.includeAcervoInPrompt, false);
  });

  it("você grava a conversa → privacidade", () => {
    const t = analyzeChatTurn("você grava a conversa", [], { nomeFantasia: "FYT" });
    assert.equal(t.route, "identity");
    assert.match(t.identityAnswer || "", /sess[aã]o|privacidade|dados/i);
    assert.equal(t.perfilGeralTheme, "PRIVACIDADE_DADOS");
  });
});
