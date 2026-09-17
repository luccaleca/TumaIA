import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractOfferFromText,
  extractScenarioFromText,
  extractLayoutEmphasis,
  extractIntentFromText,
  parseCreationTurn,
} from "../../backend/src/services/chatCreationInterpret.js";
import { buildArteBriefFromHistory } from "../../backend/src/services/rawImageArteBrief.js";

describe("interpretação semântica — unidades da frase", () => {
  it("arte promocional + fundo academia + R$ 79,90 bem destacado", () => {
    const q =
      "Quero uma arte promocional desse produto /whey-de-baunilha, com fundo de academia e o preço de R$ 79,90 bem destacado. Algo moderno e profissional.";
    const t = parseCreationTurn(q);
    assert.match(t.productQuery || "", /whey|baunilha/i);
    assert.equal(t.intent, "promocao");
    assert.equal(t.scenario, "academia");
    assert.doesNotMatch(t.scenario || "", /preco|preço|79/i);
    assert.match(t.offer || "", /79/);
    assert.match(t.layout || "", /pre[cç]o|destaque/i);
    assert.ok(t.style.some((s) => /moderno|profissional/i.test(s)));

    const brief = buildArteBriefFromHistory([{ role: "user", content: q }], []);
    assert.match(brief.tema, /academia/i);
    assert.doesNotMatch(brief.tema, /Academia o Preco/i);
    assert.match(brief.texto || brief.tema, /79/);
    assert.match(brief.estilo || "", /moderno|profissional/i);
  });

  it("generaliza a mesma intenção com frases diferentes", () => {
    const cases = [
      {
        q: "faz uma promoção desse whey por 79,90",
        expect: { offer: /79/, product: /whey/i, intent: "promocao" },
      },
      {
        q: "coloca o valor de 79,90 bem grande",
        expect: { offer: /79/, layout: /pre[cç]o|destaque/i },
      },
      {
        q: "quero vender esse produto por R$ 79,90",
        expect: { offer: /79/ },
      },
      {
        q: "faz uma arte desse whey numa academia",
        expect: { scenario: "academia", product: /whey/i },
      },
      {
        q: "deixa o preço chamando bastante atenção",
        expect: { layout: /pre[cç]o|destaque/i },
      },
      {
        q: "quero algo mais sofisticado",
        expect: { style: /sofisticado/i },
      },
      {
        q: "faz parecer uma foto profissional",
        expect: { style: /profissional/i },
      },
      {
        q: "coloca o produto em um ambiente de academia, mas deixa espaço para o preço",
        expect: { scenario: "academia", layout: /pre[cç]o|espa[cç]o|destaque/i },
      },
      {
        q: "faz uma campanha de verão e coloca a oferta no destaque",
        expect: { intent: "campanha", theme: /ver[aã]o/i, layout: /destaque|pre[cç]o|oferta/i },
      },
    ];

    for (const { q, expect } of cases) {
      const t = parseCreationTurn(q);
      if (expect.offer) assert.match(t.offer || extractOfferFromText(q), expect.offer, q);
      if (expect.scenario) assert.equal(t.scenario, expect.scenario, q);
      if (expect.product) assert.match(t.productQuery || "", expect.product, q);
      if (expect.intent) assert.equal(t.intent, expect.intent, q);
      if (expect.layout) assert.match(t.layout || extractLayoutEmphasis(q), expect.layout, q);
      if (expect.style) assert.ok((t.style || []).some((s) => expect.style.test(s)), q);
      if (expect.theme) assert.match(t.theme || "", expect.theme, q);
      assert.doesNotMatch(t.scenario || "", /79|preco|preço/i, q);
    }
  });

  it("não transforma preço em cenário", () => {
    assert.equal(extractScenarioFromText("fundo de academia e o preço de R$ 79,90"), "academia");
    assert.match(extractOfferFromText("o preço de R$ 79,90 bem destacado"), /79/);
    assert.match(extractLayoutEmphasis("preço de R$ 79,90 bem destacado"), /destaque/i);
    assert.equal(extractIntentFromText("arte promocional do whey"), "promocao");
  });
});
