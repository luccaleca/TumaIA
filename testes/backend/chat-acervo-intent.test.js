import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyChatAcervoIntent,
  historySuggestsCatalogListing,
} from "../../backend/src/services/chatIntent.js";

const CATALOG_HISTORY = [
  {
    role: "user",
    content: "quero saber oq temos de whey protein",
  },
  {
    role: "assistant",
    content:
      "No acervo da FYT, relacionados a «whey growth», temos 3 produtos:\n\n" +
      "• whey de baunilha\n• whey de chocolate\n• whey de cookie\n\n" +
      "Quer montar post de algum deles?",
  },
];
import { tryChatAcervoResponse } from "../../backend/src/services/chatAcervoResponse.js";

describe("chat acervo intent", () => {
  it("listar: oq temos de produtos", () => {
    assert.equal(classifyChatAcervoIntent("quero saber oq temos de produtos").kind, "LISTAR_PRODUTOS");
  });

  it("listar: tuma, que produtos temos disponiveis (vocativo não vira identidade)", () => {
    assert.equal(
      classifyChatAcervoIntent("tuma, que produtos temos disponiveis").kind,
      "LISTAR_PRODUTOS",
    );
  });

  it("listar: o que temos", () => {
    assert.equal(classifyChatAcervoIntent("o que temos").kind, "LISTAR_PRODUTOS");
  });

  it("info: tem whey", () => {
    const r = classifyChatAcervoIntent("tem whey?");
    assert.equal(r.kind, "INFO_PRODUTO");
    assert.match(r.termo || "", /whey/i);
  });

  it("histórico: detecta listagem de catálogo", () => {
    assert.equal(historySuggestsCatalogListing(CATALOG_HISTORY), true);
    assert.equal(historySuggestsCatalogListing([]), false);
  });

  it("follow-up sem contexto: e sobre pro force → NONE (LLM explica)", () => {
    assert.equal(classifyChatAcervoIntent("e sobre pro force").kind, "NONE");
    assert.equal(classifyChatAcervoIntent("e o pro force").kind, "NONE");
  });

  it("follow-up com contexto de catálogo: e sobre / e o pro force → LISTAR", () => {
    for (const q of ["e sobre pro force", "e o pro force"]) {
      const r = classifyChatAcervoIntent(q, CATALOG_HISTORY);
      assert.equal(r.kind, "LISTAR_PRODUTOS", q);
      assert.ok(r.filtro);
      assert.match(r.termo || "", /pro force/i);
    }
  });

  it("listar follow-up pro force: todos os itens e bullets em linhas separadas", async () => {
    const midias = [
      { tipo_midia: "imagem", nome_exibicao: "pro force cafe" },
      { tipo_midia: "imagem", nome_exibicao: "pro force chocolate" },
      { tipo_midia: "imagem", nome_exibicao: "pro force conjunto 4" },
      { tipo_midia: "imagem", nome_exibicao: "pro force morango" },
      { tipo_midia: "imagem", nome_exibicao: "pro force cookies (1)" },
      { tipo_midia: "imagem", nome_exibicao: "whey de chocolate" },
    ];
    const ans = await tryChatAcervoResponse({
      question: "e sobre pro force",
      history: CATALOG_HISTORY,
      idEmpresa: "00000000-0000-0000-0000-000000000001",
      nomeFantasia: "FYT",
      midias,
      classifyIntent: classifyChatAcervoIntent,
    });
    assert.match(ans || "", /relacionados a «pro force»/i);
    assert.match(ans || "", /5 produtos/);
    assert.match(ans || "", /• pro force cafe/);
    assert.match(ans || "", /• pro force cookies/i);
    assert.doesNotMatch(ans || "", /• whey/i);
    const introEnd = (ans || "").indexOf("• pro force cafe");
    const beforeFirstBullet = (ans || "").slice(0, introEnd);
    assert.match(beforeFirstBullet, /:\s*$/);
    assert.match(ans || "", /• pro force morango\n\nQuer montar post/);
  });

  it("listar filtrado: naked waffer → só linha naked wafer", async () => {
    const intent = classifyChatAcervoIntent(
      "perfeito, produtos relacionados a barrinha naked waffer, oq temos?",
    );
    assert.equal(intent.kind, "LISTAR_PRODUTOS");
    assert.ok(intent.filtro);
    const midias = [
      { tipo_midia: "imagem", nome_exibicao: "naked wafer chocolate branco" },
      { tipo_midia: "imagem", nome_exibicao: "naked wafer cinnamon" },
      { tipo_midia: "imagem", nome_exibicao: "whey de chocolate" },
      { tipo_midia: "imagem", nome_exibicao: "monster" },
    ];
    const ans = await tryChatAcervoResponse({
      question: "produtos relacionados a barrinha naked waffer, oq temos?",
      idEmpresa: "00000000-0000-0000-0000-000000000001",
      nomeFantasia: "FYT",
      midias,
      classifyIntent: classifyChatAcervoIntent,
    });
    assert.match(ans || "", /relacionados a «naked wafer»/i);
    assert.match(ans || "", /naked wafer chocolate/i);
    assert.match(ans || "", /naked wafer cinnamon/i);
    assert.doesNotMatch(ans || "", /• whey/i);
    assert.doesNotMatch(ans || "", /• monster/i);
    assert.match(ans || "", /2 produtos/);
  });

  it("resposta listar não cita «de produtos»", async () => {
    const ans = await tryChatAcervoResponse({
      question: "quero saber oq temos de produtos",
      idEmpresa: "00000000-0000-0000-0000-000000000001",
      nomeFantasia: "FYT",
      midias: [
        { tipo_midia: "imagem", nome_exibicao: "whey de chocolate" },
        { tipo_midia: "imagem", nome_exibicao: "monster" },
      ],
      classifyIntent: classifyChatAcervoIntent,
    });
    assert.match(ans || "", /acervo|produtos/i);
    assert.doesNotMatch(ans || "", /«de produtos»/i);
    assert.match(ans || "", /whey de chocolate/i);
  });
});
