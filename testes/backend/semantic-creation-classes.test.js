/**
 * Testes de CLASSE semântica — generalização, não frases decoradas.
 * Cada bloco cobre uma família de construções equivalentes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseCreationTurn,
  mergeCreationState,
  emptyCreationState,
  deriveCreationStateFromHistory,
  extractOfferFromText,
  extractScenarioFromText,
  extractStyleTermsFromText,
} from "../../backend/src/services/chatCreationInterpret.js";
import { buildArteBriefFromHistory } from "../../backend/src/services/rawImageArteBrief.js";

describe("classe: preço sem preposição padrão", () => {
  const phrases = [
    "inclui o valor: 89,90",
    "o preço fica 89,90",
    "vai custar 89,90",
    "bota 89,90 nessa",
    "o valor é 89,90",
    "89,90 no destaque",
    "custa 89,90 na arte",
    "o comercial: 89,90",
  ];
  for (const q of phrases) {
    it(`oferta em: ${q}`, () => {
      assert.match(extractOfferFromText(q), /89/);
      assert.match(parseCreationTurn(q).offer || "", /89/);
    });
  }
});

describe("classe: destaque coloquial do preço", () => {
  const phrases = [
    "o 89,90 precisa pular na cara",
    "deixa a oferta gritando — 89,90",
    "89,90 bem aparente na peça",
    "evidencia o valor de 89,90",
  ];
  for (const q of phrases) {
    it(`destaque em: ${q}`, () => {
      const t = parseCreationTurn(q);
      assert.match(t.offer || "", /89/);
      assert.match(t.layout || "", /pre[cç]o|destaque/i);
    });
  }
});

describe("classe: sinônimos de cenário", () => {
  const phrases = [
    ["monta no gym", "academia"],
    ["fundo de academia", "academia"],
    ["ambiente de treino", "academia"],
    ["cenário fitness", "academia"],
    ["leva pra praia", "praia"],
  ];
  for (const [q, label] of phrases) {
    it(`${q} → ${label}`, () => {
      assert.equal(extractScenarioFromText(q), label);
    });
  }
});

describe("classe: estilo por paráfrase", () => {
  const phrases = [
    [/photorealistic|realista|fotografia/i, "cara de foto de verdade"],
    [/photorealistic|realista/i, "fotografia real"],
    [/editorial/i, "visual editorial"],
    [/cinematic|cinematograf/i, "pode ser cinematográfico"],
    [/vibrante/i, "mais vibrante"],
  ];
  for (const [re, q] of phrases) {
    it(`estilo: ${q}`, () => {
      const styles = extractStyleTermsFromText(q);
      assert.ok(styles.some((s) => re.test(s)), `styles=${JSON.stringify(styles)}`);
      assert.equal(parseCreationTurn(q).productQuery, null);
    });
  }
});

describe("classe: alteração de estado (preserva o resto)", () => {
  function base() {
    return deriveCreationStateFromHistory([
      { role: "user", content: "Quero esse whey na academia por R$ 79,90." },
    ]);
  }

  it("troca só o preço (várias formas)", () => {
    for (const q of [
      "Troca o valor pro 69,90.",
      "O preço certo é 69,90.",
      "Agora fica 69,90.",
      "Muda pra 69,90.",
    ]) {
      const state = mergeCreationState(base(), parseCreationTurn(q), q);
      assert.match(state.oferta, /69/);
      assert.match(state.produto, /whey/i);
      assert.equal(state.cenario, "academia");
    }
  });

  it("troca só o cenário (várias formas)", () => {
    for (const q of [
      "Esquece academia — põe praia.",
      "Muda o ambiente pra praia.",
      "Agora o fundo é praia.",
      "Troca pro cenário de praia.",
    ]) {
      const state = mergeCreationState(base(), parseCreationTurn(q), q);
      assert.equal(state.cenario, "praia");
      assert.match(state.produto, /whey/i);
      assert.match(state.oferta, /79/);
    }
  });
});

describe("classe: substituição de produto", () => {
  function base() {
    return deriveCreationStateFromHistory([
      { role: "user", content: "Quero uma arte do whey na academia por R$ 79,90." },
    ]);
  }

  it("formas de substituir whey → creatina", () => {
    for (const q of [
      "Em vez do whey, usa creatina.",
      "No lugar do whey, usa creatina.",
      "Troca o whey pela creatina.",
      "Substitui pelo da creatina.",
      "Agora faz com a creatina.",
    ]) {
      const state = mergeCreationState(base(), parseCreationTurn(q), q);
      assert.match(state.produto, /creatina/i);
      assert.doesNotMatch(state.produto, /whey/i);
      assert.equal(state.cenario, "academia");
      assert.match(state.oferta, /79/);
    }
  });
});

describe("classe: referência vaga (não inventar)", () => {
  const phrases = [
    "Faz uma arte daquele item novo que a gente falou.",
    "Usa o produto que eu mencionei ontem.",
    "Quero arte daquela coisa lá.",
    "Monta aquele produto novo.",
  ];
  for (const q of phrases) {
    it(`clarificar: ${q}`, () => {
      const t = parseCreationTurn(q);
      assert.equal(t.needsProductClarification, true);
      assert.equal(t.productQuery, null);
    });
  }
});

describe("classe: brief final preserva oferta", () => {
  it("preço entra no arte_brief.texto ou tema", () => {
    for (const q of [
      "Post do whey no treino, 79,90 em evidência, moderno.",
      "Whey na academia com 79,90.",
      "Arte do whey — valor 89,90.",
    ]) {
      const brief = buildArteBriefFromHistory([{ role: "user", content: q }], []);
      assert.match(`${brief.texto} ${brief.tema}`, /79|89/);
    }
  });
});

describe("classe: multi-turno acumula sem apagar", () => {
  it("produto → preço → destaque → estilo", () => {
    let state = emptyCreationState();
    const turns = [
      "Me faz uma peça do whey no gym.",
      "Inclui 79,90.",
      "Esse valor tem que chamar atenção.",
      "Agora sobe o luxo.",
    ];
    for (const q of turns) {
      state = mergeCreationState(state, parseCreationTurn(q), q);
    }
    assert.match(state.produto, /whey/i);
    assert.equal(state.cenario, "academia");
    assert.match(state.oferta, /79/);
    assert.match(state.destaque || "", /pre[cç]o|destaque/i);
    assert.match(state.estilo || "", /luxo|luxury|premium/i);
  });
});
