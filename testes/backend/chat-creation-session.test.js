import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyChatAcervoIntent,
  scrubAcervoNoiseText,
  extractAcervoListFilter,
} from "../../backend/src/services/chatIntent.js";
import {
  composeCreationPedidoHint,
  deriveCreationStateFromHistory,
  isCreationRevisionOnly,
  isVisualStyleTerm,
  mergeCreationState,
  parseCreationTurn,
  shouldPreferImageBriefingOverAcervo,
  shouldSkipAcervoForCreationFollowUp,
} from "../../backend/src/services/chatCreationInterpret.js";
import { resolveActivePedidoHint } from "../../backend/src/services/imageHeadline.js";
import { tryChatAcervoResponse } from "../../backend/src/services/chatAcervoResponse.js";
import { buildArteBriefFromHistory } from "../../backend/src/services/rawImageArteBrief.js";
import { parseProductMentionSpec } from "../../backend/src/services/productMentionMatch.js";
import { detectImageGenerationIntent } from "../../backend/src/services/tumaInterpretation.js";
import { analyzeChatTurn } from "../../backend/src/services/chatTurnIntent.js";

describe("criação — interpretação contínua", () => {
  it("estilo não é termo de produto", () => {
    assert.equal(isVisualStyleTerm("photorealistic"), true);
    assert.equal(isVisualStyleTerm("premium"), true);
    assert.equal(isVisualStyleTerm("powerade"), false);
  });

  it("strip: query de produto sem estilo/tema/preço", () => {
    const q = scrubAcervoNoiseText(
      "quero uma promoção do Powerade photorealistic com preço grande",
    );
    assert.match(q, /powerade/i);
    assert.doesNotMatch(q, /photorealistic|promocao|preco/i);
  });

  it("filtro acervo: só Powerade (não photorealistic)", () => {
    const f = extractAcervoListFilter(
      "quero uma promoção do Powerade photorealistic com preço grande",
    );
    assert.ok(f);
    const terms = [...(f.genericTerms || []), ...(f.specificPhrases || [])].join(" ");
    assert.match(terms, /powerade/i);
    assert.doesNotMatch(terms, /photorealistic|premium|clean/i);
  });

  it("parseCreationTurn: mensagem completa em categorias", () => {
    const t = parseCreationTurn(
      "faz uma promoção de natal do Powerade, 1 por 10 e 3 por 20, estilo photorealistic e preço grande",
    );
    assert.match(t.productQuery || "", /powerade/i);
    assert.equal(t.intent, "promocao");
    assert.equal(t.theme, "Natal");
    assert.match(t.offer || "", /1 por/i);
    assert.ok(t.style.some((s) => /photorealistic/i.test(s)));
    assert.match(t.layout || "", /pre[cç]o/i);
  });

  it("fluxo 1: /powerade → natal → oferta → estilo → destaque (estado acumulado)", () => {
    const history = [];
    let state = deriveCreationStateFromHistory(history);

    state = mergeCreationState(state, parseCreationTurn("/powerade"));
    assert.match(state.produto, /powerade/i);

    state = mergeCreationState(state, parseCreationTurn("quero uma promoção de natal"));
    assert.match(state.produto, /powerade/i);
    assert.equal(state.intencao, "promocao");
    assert.equal(state.tema, "Natal");

    state = mergeCreationState(state, parseCreationTurn("1 por 10 e 3 por 20"));
    assert.match(state.oferta, /1 por/i);
    assert.match(state.produto, /powerade/i);

    state = mergeCreationState(state, parseCreationTurn("faz photorealistic"));
    assert.match(state.estilo, /photorealistic/i);
    assert.match(state.produto, /powerade/i);

    state = mergeCreationState(state, parseCreationTurn("deixa os preços em evidência"));
    assert.match(state.destaque, /pre[cç]o/i);
    assert.match(state.produto, /powerade/i);
  });

  it("fluxo 2: agora mais premium não busca produto premium", () => {
    const history = [
      { role: "user", content: "/powerade faz uma promoção" },
      { role: "assistant", content: "Powerade selecionado." },
    ];
    assert.equal(shouldSkipAcervoForCreationFollowUp("agora mais premium", history), true);
    assert.equal(classifyChatAcervoIntent("agora mais premium", history).kind, "NONE");
    assert.equal(isCreationRevisionOnly("agora mais premium"), true);
  });

  it("fluxo 5: clean e photorealistic nunca viram busca de produto", () => {
    const r = classifyChatAcervoIntent("quero algo clean e photorealistic");
    assert.equal(r.kind, "NONE");
    const spec = parseProductMentionSpec("quero algo clean e photorealistic");
    assert.ok(!spec.genericTerms?.includes("clean"));
    assert.ok(!spec.genericTerms?.includes("photorealistic"));
  });

  it("promoção de natal após /powerade: não reconsulta acervo", () => {
    const history = [{ role: "user", content: "/powerade" }];
    assert.equal(
      shouldSkipAcervoForCreationFollowUp("quero uma promoção de natal", history),
      true,
    );
    assert.equal(classifyChatAcervoIntent("quero uma promoção de natal", history).kind, "NONE");
  });

  it("compose hint mantém produto em follow-up de estilo", () => {
    const history = [
      { role: "user", content: "/powerade" },
      { role: "assistant", content: "Powerade selecionado." },
      { role: "user", content: "promoção de natal" },
      { role: "user", content: "1 por 10 e 3 por 20" },
    ];
    const hint = composeCreationPedidoHint(history, { question: "faz photorealistic" });
    assert.match(hint, /powerade/i);
    assert.match(hint, /natal|promocao|photorealistic|1 por/i);
  });

  it("resolveActivePedidoHint: revisão de estilo não apaga produto", () => {
    const history = [
      { role: "user", content: "monta um post de promocao do powerade" },
      { role: "assistant", content: "Resumo pronto." },
      { role: "user", content: "faz photorealistic" },
    ];
    const hint = resolveActivePedidoHint(history, { question: "faz photorealistic" });
    assert.match(hint, /powerade/i);
    assert.doesNotMatch(hint, /^faz photorealistic$/i);
  });

  it("arte_brief acumula estilo e tema da sessão", () => {
    const history = [
      { role: "user", content: "/powerade" },
      { role: "user", content: "promoção de natal" },
      { role: "user", content: "1 por 10 e 3 por 20" },
      { role: "user", content: "photorealistic" },
    ];
    const brief = buildArteBriefFromHistory(history);
    assert.match(brief.estilo || "", /photorealistic/i);
    assert.match(brief.tema || "", /natal|powerade|promocao|1 por/i);
  });

  it("slash anexo bare: Powerade selecionado", async () => {
    const powerId = "eaa8db0b-64ff-4b74-92d2-f21111111111";
    const ans = await tryChatAcervoResponse({
      question: "/powerade",
      idEmpresa: "00000000-0000-0000-0000-000000000001",
      nomeFantasia: "FYT",
      midias: [
        { id_midia: powerId, tipo_midia: "imagem", nome_exibicao: "Powerade" },
        { id_midia: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", tipo_midia: "imagem", nome_exibicao: "creatina" },
      ],
      referenceMidiaIds: [powerId],
      classifyIntent: classifyChatAcervoIntent,
    });
    assert.match(ans || "", /Powerade selecionado/i);
    assert.doesNotMatch(ans || "", /creatina/i);
  });

  it("produto photorealistic na frase: não usa photorealistic como termo", () => {
    const r = classifyChatAcervoIntent(
      "quero uma promocao do produto photorealistic",
    );
    assert.ok(r.kind === "NONE" || (r.termo && !/photorealistic/i.test(r.termo)));
  });

  it("monster + natal + preços: abre briefing, não lista catálogo burro", () => {
    const q =
      "preciso de uma foto do produto /monster.png-437a4d60-d4b0-462d-ad5f- desconto de natal, 1 é 10 e 3 é 20. Deixe a tematica do natal em cima do produto e os precos bem aparentes";
    const turn = parseCreationTurn(q);
    assert.match(turn.productQuery || "", /monster/i);
    assert.equal(turn.theme, "Natal");
    assert.match(turn.offer || "", /1 por.*10.*3 por.*20/i);
    assert.match(turn.layout || "", /pre[cç]o|tem[aá]tica/i);
    assert.equal(shouldPreferImageBriefingOverAcervo(q), true);
    assert.equal(classifyChatAcervoIntent(q).kind, "NONE");
    assert.equal(detectImageGenerationIntent(q), true);
    const analyzed = analyzeChatTurn(q, []);
    assert.equal(analyzed.wantsImageRoute, true);
    assert.notEqual(analyzed.route, "acervo");
  });

  it("slash /monster.png-UUID resolve mídia e não pede descrição", async () => {
    const monsterId = "437a4d60-d4b0-462d-ad5f-aaaaaaaaaaaa";
    const q =
      "preciso de uma foto do produto /monster.png-437a4d60-d4b0-462d-ad5f- desconto de natal, 1 é 10 e 3 é 20";
    const ans = await tryChatAcervoResponse({
      question: q,
      idEmpresa: "00000000-0000-0000-0000-000000000001",
      nomeFantasia: "FYT",
      midias: [
        { id_midia: monsterId, tipo_midia: "imagem", nome_exibicao: "Monster" },
        {
          id_midia: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          tipo_midia: "imagem",
          nome_exibicao: "creatina",
        },
      ],
      referenceMidiaIds: [],
      classifyIntent: classifyChatAcervoIntent,
    });
    assert.match(ans || "", /Monster/i);
    assert.doesNotMatch(ans || "", /Descreva|creatina/i);
  });
});
