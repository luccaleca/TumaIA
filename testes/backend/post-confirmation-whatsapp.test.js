import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inferPreferredPlaybookSlug } from "../../backend/src/services/cadastroMeaningful.js";
import { buildWhatsappPostConfirmation } from "../../backend/src/services/postConfirmationWhatsapp.js";

describe("cadastroMeaningful — modelo de post", () => {
  it("modelo de produto no pedido → slug produto", () => {
    assert.equal(
      inferPreferredPlaybookSlug("postagem no modelo de produto com whey de cookie"),
      "produto",
    );
    assert.equal(
      inferPreferredPlaybookSlug(
        "quero um post com modelo de post de produto do naked wafer dark chocolate",
      ),
      "produto",
    );
  });
});

describe("postConfirmationWhatsapp", () => {
  it("monta resumo com modelo, produto e cena", () => {
    const msg = buildWhatsappPostConfirmation(
      {
        matched_contexto: { nome: "Produto" },
        hero_product: { nome_exibicao: "Whey Cookie" },
        intent_summary:
          "pessoa na academia usando whey de cookie para simbolizar força",
        montagem_resumo: "Academia · Whey · Força",
      },
      [{ kind: "contexto", id: "1", label: "Produto" }],
      { briefingStatus: "ready" },
    );
    assert.match(msg, /Modelo de post.*Produto/i);
    assert.match(msg, /Whey Cookie/i);
    assert.match(msg, /gerar imagem/i);
  });
});
