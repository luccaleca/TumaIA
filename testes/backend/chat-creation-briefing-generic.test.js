import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyChatAcervoIntent,
  extractAcervoListFilter,
} from "../../backend/src/services/chatIntent.js";
import {
  deriveCreationStateFromHistory,
  hasRichCreationBrief,
  isCatalogListingRequest,
  mergeCreationState,
  parseCreationTurn,
  shouldPreferImageBriefingOverAcervo,
  shouldSkipAcervoForCreationFollowUp,
} from "../../backend/src/services/chatCreationInterpret.js";
import { analyzeChatTurn } from "../../backend/src/services/chatTurnIntent.js";

/**
 * @param {ReturnType<typeof parseCreationTurn>} turn
 * @param {Record<string, RegExp | string | boolean>} expect
 */
function assertTurnFields(turn, expect) {
  for (const [key, want] of Object.entries(expect)) {
    const got = turn[key];
    if (want instanceof RegExp) {
      if (Array.isArray(got)) {
        assert.ok(
          got.some((x) => want.test(String(x))),
          `${key}: expected ${want} in ${JSON.stringify(got)}`,
        );
      } else {
        assert.match(String(got || ""), want, `${key}=${got}`);
      }
    } else if (typeof want === "boolean") {
      assert.equal(Boolean(got), want, `${key}=${got}`);
    } else {
      assert.equal(got, want, `${key}=${got}`);
    }
  }
}

describe("criação — briefing genérico por categorias", () => {
  it("/whey lançamento sabor paçoca tema festa junina", () => {
    const q = "/whey lançamento sabor paçoca tema festa junina";
    const t = parseCreationTurn(q);
    assertTurnFields(t, {
      productQuery: /whey/i,
      intent: "lancamento",
      flavor: /pa[cç]oca/i,
      theme: /festa junina/i,
    });
    assert.equal(shouldPreferImageBriefingOverAcervo(q), true);
    assert.equal(classifyChatAcervoIntent(q).kind, "NONE");
  });

  it("/creatina campanha de inverno premium", () => {
    const q = "/creatina campanha de inverno premium";
    const t = parseCreationTurn(q);
    assertTurnFields(t, {
      productQuery: /creatina/i,
      intent: "campanha",
      theme: /inverno/i,
      style: /premium/i,
    });
    assert.equal(hasRichCreationBrief(q), true);
    assert.equal(shouldPreferImageBriefingOverAcervo(q), true);
    assert.notEqual(analyzeChatTurn(q, []).route, "acervo");
  });

  it("/monster promoção de natal 1 por 10 e 3 por 20", () => {
    const q = "/monster promoção de natal 1 por 10 e 3 por 20";
    const t = parseCreationTurn(q);
    assertTurnFields(t, {
      productQuery: /monster/i,
      intent: "promocao",
      theme: "Natal",
      offer: /1 por.*10.*3 por.*20/i,
    });
    assert.equal(classifyChatAcervoIntent(q).kind, "NONE");
  });

  it("/barra-proteica verão praia 15g de proteína", () => {
    const q = "/barra-proteica verão praia 15g de proteína";
    const t = parseCreationTurn(q);
    assertTurnFields(t, {
      productQuery: /barra proteica/i,
      theme: /ver[aã]o/i,
      scenario: /praia/i,
      characteristic: /15g de prote/i,
    });
    assert.equal(shouldPreferImageBriefingOverAcervo(q), true);
  });

  it("/cafe promoção 2 por 15", () => {
    const q = "/cafe promoção 2 por 15";
    const t = parseCreationTurn(q);
    assertTurnFields(t, {
      productQuery: /cafe/i,
      intent: "promocao",
      offer: /2 por R\$15/i,
    });
    assert.equal(hasRichCreationBrief(q), true);
  });

  it("mesma estrutura com energético + melancia + verão (não é regra de whey)", () => {
    const q = "/energetico lançamento sabor melancia tema de verão";
    const t = parseCreationTurn(q);
    assertTurnFields(t, {
      productQuery: /energetico/i,
      intent: "lancamento",
      flavor: /melancia/i,
      theme: /ver[aã]o/i,
    });
  });

  it("revisão /whey faz mais premium — não busca premium no acervo", () => {
    const history = [{ role: "user", content: "/whey" }];
    const q = "faz mais premium";
    const t = parseCreationTurn(q);
    assert.ok(t.style.some((s) => /premium/i.test(s)));
    assert.equal(t.productQuery, null);
    assert.equal(shouldSkipAcervoForCreationFollowUp(q, history), true);
    assert.equal(classifyChatAcervoIntent(q, history).kind, "NONE");
    const state = deriveCreationStateFromHistory(history, q);
    assert.match(state.produto, /whey/i);
    assert.match(state.estilo, /premium/i);
  });

  it("sessão multi-turno: produto → lançamento → sabor → tema → estilo", () => {
    let state = deriveCreationStateFromHistory([]);
    state = mergeCreationState(state, parseCreationTurn("/whey"));
    assert.match(state.produto, /whey/i);

    state = mergeCreationState(state, parseCreationTurn("quero lançar ele"));
    assert.equal(state.intencao, "lancamento");
    assert.match(state.produto, /whey/i);

    state = mergeCreationState(state, parseCreationTurn("sabor paçoca"));
    assert.match(state.sabor, /pa[cç]oca/i);

    state = mergeCreationState(state, parseCreationTurn("tema festa junina"));
    assert.match(state.tema, /festa junina/i);

    state = mergeCreationState(state, parseCreationTurn("faz mais premium"));
    assert.match(state.estilo, /premium/i);
    assert.match(state.produto, /whey/i);
    assert.match(state.sabor, /pa[cç]oca/i);
    assert.match(state.tema, /festa junina/i);
  });

  it("troca de produto atualiza só o produto", () => {
    const history = [
      { role: "user", content: "/whey promoção de natal" },
      { role: "user", content: "1 por 10" },
    ];
    const state = deriveCreationStateFromHistory(history, "troca para creatina");
    assert.match(state.produto, /creatina/i);
    assert.equal(state.intencao, "promocao");
    assert.equal(state.tema, "Natal");
    assert.match(state.oferta, /1 por/i);
  });

  it("estilo/academia/preço não viram busca de produto", () => {
    const history = [{ role: "user", content: "/creatina" }];
    const q = "faz uma versão mais realista, com fundo de academia e preço grande";
    assert.equal(classifyChatAcervoIntent(q, history).kind, "NONE");
    const t = parseCreationTurn(q);
    assert.ok(t.style.some((s) => /realista|photorealistic/i.test(s)));
    assert.match(t.scenario || "", /academia/i);
    assert.match(t.layout || "", /pre[cç]o/i);
    const f = extractAcervoListFilter(q);
    const terms = [...(f?.genericTerms || []), ...(f?.specificPhrases || [])].join(" ");
    assert.doesNotMatch(terms, /realista|academia|preco|premium/i);
  });

  it("catálogo combinatório continua listagem (não briefing de arte)", () => {
    const q =
      "vc consegue fazer uma promocao de chocolate na fyt? entao todos os produtos que tem chocolate a gente coloca nessa promocao sera 40% de desconto";
    assert.equal(isCatalogListingRequest(q), true);
    assert.equal(shouldPreferImageBriefingOverAcervo(q), false);
    assert.equal(classifyChatAcervoIntent(q).kind, "USO_ACERVO_PROMO");
  });

  it("produto sem briefing: só seleção", () => {
    const t = parseCreationTurn("/monster");
    assert.match(t.productQuery || "", /monster/i);
    assert.equal(t.isBareSelection, true);
    assert.equal(hasRichCreationBrief("/monster"), false);
  });

  it("briefing sem produto novo usa produto da sessão", () => {
    const history = [{ role: "user", content: "/whey" }];
    const q = "quero um lançamento de festa junina";
    const state = deriveCreationStateFromHistory(history, q);
    assert.match(state.produto, /whey/i);
    assert.equal(state.intencao, "lancamento");
    assert.match(state.tema, /festa junina/i);
    assert.equal(shouldSkipAcervoForCreationFollowUp(q, history), true);
  });

  it("linguagem natural sem slash: whey paçoca festa junina", () => {
    const q = "quero lançar um whey de paçoca na festa junina";
    const t = parseCreationTurn(q);
    assert.match(t.productQuery || "", /whey/i);
    assert.equal(t.intent, "lancamento");
    assert.match(t.theme, /festa junina/i);
  });

  it("divulgação + inverno + premium (exemplo 3)", () => {
    const history = [{ role: "user", content: "/creatina" }];
    const q = "quero divulgar esse produto no inverno, com uma estética mais premium";
    const state = deriveCreationStateFromHistory(history, q);
    assert.match(state.produto, /creatina/i);
    assert.equal(state.intencao, "divulgacao");
    assert.equal(state.tema, "Inverno");
    assert.match(state.estilo, /premium/i);
  });
});
