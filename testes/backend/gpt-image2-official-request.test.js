import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GPT_IMAGE_REFERENCE_MAX,
  orderGptImage2ReferenceIds,
  buildOfficialGptImage2Prompt,
} from "../../backend/src/services/gptImage2OfficialRequest.js";

describe("gpt-image-2 official request shape", () => {
  it("ordena até 4 refs: 3 produtos + logo por último", () => {
    const ids = orderGptImage2ReferenceIds(["p1", "p2", "p3", "p4"], {
      heroProductId: "p2",
      logoId: "logo",
      logoAsHero: false,
    });
    assert.equal(ids.length, 4);
    assert.equal(ids[0], "p2");
    assert.equal(ids[ids.length - 1], "logo");
  });

  it("prompt em bloco único estilo documentação OpenAI", () => {
    const p = buildOfficialGptImage2Prompt({
      nomeFantasia: "FYT",
      productNames: ["pro force chocolate", "pro force morango"],
      pedido: "post infantil com desconto 50%",
      fraseNaImagem: "50% OFF",
      aspectRatio: "1:1",
      logoInReferences: true,
      heroProductName: "pro force chocolate",
    });
    assert.match(p, /^Generate a photorealistic promotional image/i);
    assert.match(p, /reference pictures/i);
    assert.match(p, /containing all the items/i);
    assert.match(p, /50% OFF/);
    assert.match(p, /watermark/i);
    assert.doesNotMatch(p, /MODO FUNDO PARA COLAGEM/i);
    assert.doesNotMatch(p, /\n\n\n/);
  });

  it("inclui playbook do modelo de post quando informado", () => {
    const p = buildOfficialGptImage2Prompt({
      nomeFantasia: "FYT",
      productNames: ["whey growth"],
      pedido: "post promocional 2 por 149",
      contextoNome: "Promoção",
      modeloPostPrompt:
        "Modelo PROMOÇÃO para Instagram. Hierarquia: gancho no topo, produto no centro, preço em destaque.",
      aspectRatio: "1:1",
      heroProductName: "whey growth",
    });
    assert.match(p, /Post layout playbook \(Promoção\)/i);
    assert.match(p, /Hierarquia: gancho no topo/i);
    assert.match(p, /Creative direction from the client: post promocional/i);
  });

  it("API aceita no máximo 4 imagens", () => {
    assert.equal(GPT_IMAGE_REFERENCE_MAX, 4);
  });
});
