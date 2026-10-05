import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aplicarAjustesDoCliente, buildConfirmedImageIntent } from "../../backend/src/services/imageIntent.js";
import { buildIntegratedProductImagePrompt } from "../../backend/src/services/imagePreviewPrompt.js";

const PEDIDO =
  "Faz um post da pizza de queijo para a promoção de quinta: pizza grande por R$ 49. Frase: Quinta da pizza, grande por R$ 49";
const HISTORY = [{ role: "user", content: PEDIDO }];
const AJUSTES = {
  frase: "Quinta da pizza, grande por R$ 59",
  detalhes: "fundo mais claro",
  cores: ["#112233"],
  preco_de: "R$ 49",
  preco_para: "R$ 59",
};
const PROPOSTA = {
  intent_summary: "pizza · promocao · R$59 · preço em destaque",
  frase_na_imagem: "Quinta da pizza, grande por R$ 59",
  ajustes_do_cliente: AJUSTES,
};

describe("ajustes do cliente no cartão de confirmação", () => {
  it("aplicarAjustesDoCliente troca o preço e acrescenta frase, detalhes e cores", () => {
    const out = aplicarAjustesDoCliente(PEDIDO, "Quinta da pizza, grande por R$ 49", AJUSTES);
    assert.doesNotMatch(out.pedido, /R\$ 49/);
    assert.match(out.pedido, /R\$ 59/);
    assert.match(out.pedido, /fundo mais claro/);
    assert.match(out.pedido, /#112233/);
    assert.equal(out.fraseNaImagem, "Quinta da pizza, grande por R$ 59");
  });

  it("sem ajustes devolve pedido e frase como estavam", () => {
    assert.deepEqual(aplicarAjustesDoCliente("pedido", "frase", undefined), {
      pedido: "pedido",
      fraseNaImagem: "frase",
    });
  });

  it("buildConfirmedImageIntent usa a edição em vez do histórico", () => {
    const intent = buildConfirmedImageIntent({ history: HISTORY, postContextProposal: PROPOSTA });
    assert.equal(intent.fraseNaImagem, "Quinta da pizza, grande por R$ 59");
    assert.doesNotMatch(intent.pedido, /R\$ 49/);
  });

  it("o prompt final do acervo sai com o preço editado e sem o antigo", () => {
    const prompt = buildIntegratedProductImagePrompt(HISTORY, PROPOSTA, null, {
      productNames: ["Pizza de queijo"],
    });
    assert.match(prompt, /R\$ 59/);
    assert.doesNotMatch(prompt, /R\$ ?49/);
  });

  it("sem edição o prompt continua usando o pedido original", () => {
    const prompt = buildIntegratedProductImagePrompt(
      HISTORY,
      { intent_summary: "pizza · promocao · R$49" },
      null,
      { productNames: ["Pizza de queijo"] },
    );
    assert.match(prompt, /R\$ ?49/);
  });
});
