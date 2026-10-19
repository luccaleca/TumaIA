import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildIntegratedProductImagePrompt, buildRawImagePrompt } from "../../backend/src/services/imagePreviewPrompt.js";

const HISTORY = [
  { role: "user", content: "Faz um post com a linha de cervejas para a promoção de sexta: 3 garrafas por R$ 45. Frase: Sexta de Way Beer, 3 por R$ 45" },
];
const IDENTIDADE = {
  nome_fantasia: "Way Beer",
  cor_primaria: "#1E6FFF",
  cor_secundaria: "#000000",
  estilo_visual: "Moderno e marcante, fundo escuro, iluminação de estúdio",
  evitar: "espuma exagerada; pessoas bebendo",
};
const montar = (identidade) =>
  buildIntegratedProductImagePrompt(HISTORY, { intent_summary: "cervejas" }, identidade, {
    productNames: ["Linha de cervejas"],
  });

describe("identidade da marca no prompt de produto do acervo", () => {
  it("o prompt leva as cores (com nome), o estilo e o que evitar", () => {
    const prompt = montar(IDENTIDADE);
    assert.match(prompt, /#1E6FFF/i);
    assert.match(prompt, /blue/);
    assert.match(prompt, /#000000/);
    assert.match(prompt, /black/);
    assert.match(prompt, /Moderno e marcante/);
    assert.match(prompt, /espuma exagerada/);
  });

  it("as cores valem para o cenário e nunca para a embalagem", () => {
    const prompt = montar(IDENTIDADE);
    assert.match(prompt, /NEVER changes the product packaging/);
    assert.match(prompt, /Preserve the exact packaging design/);
    assert.doesNotMatch(prompt, /Proibido cores fora/i);
  });

  it("a marca vence quando o pedido conflita", () => {
    assert.match(montar(IDENTIDADE), /brand identity wins/);
  });

  it("sem identidade, o prompt é o mesmo de antes (sem bloco de marca)", () => {
    const prompt = montar(null);
    assert.doesNotMatch(prompt, /Brand identity/);
    assert.doesNotMatch(prompt, /Brand color palette/);
    assert.match(prompt, /Preserve the exact packaging design/);
  });
});

describe("regra contra texto inventado na arte", () => {
  it("o prompt com foto do acervo manda usar só o texto pedido, sem selos nem promessas", () => {
    const prompt = montar(IDENTIDADE);
    assert.match(prompt, /Use ONLY the text the client asked for/);
    assert.match(prompt, /Do NOT invent or add any other text, slogans, badges, stickers, promises or claims/);
  });

  it("a regra também vale sem foto do acervo (caminho «raw»)", () => {
    const prompt = buildRawImagePrompt(HISTORY, { intent_summary: "cervejas" }, IDENTIDADE, {});
    assert.match(prompt, /Use ONLY the text the client asked for/);
  });

  it("a regra não impede o texto e o preço que o cliente pediu", () => {
    const prompt = montar(IDENTIDADE);
    assert.match(prompt, /Include this campaign text prominently with correct spelling: «Sexta de Way Beer, 3 por R\$ 45»/);
  });
});

describe("a foto do acervo é a verdade sobre o produto", () => {
  it("o prompt manda reproduzir o produto como na foto, sem trocar pelo que o nome sugere", () => {
    const prompt = montar(IDENTIDADE);
    assert.match(prompt, /source of truth for how the product looks/);
    assert.match(prompt, /Reproduce the product exactly as shown/);
    assert.match(prompt, /Do NOT replace it with a different version suggested by its name or by the client's text/);
  });

  it("a regra convive com a fidelidade da embalagem e com o texto pedido", () => {
    const prompt = montar(IDENTIDADE);
    assert.match(prompt, /Preserve the exact packaging design/);
    assert.match(prompt, /Include this campaign text prominently with correct spelling/);
  });

  it("vale mesmo quando o pedido cita um sabor diferente do que a foto mostra", () => {
    const pedido = [{ role: "user", content: "Faz um post da pizza de queijo: grande por R$ 49. Frase: Terça do queijo, grande por R$ 49" }];
    const prompt = buildIntegratedProductImagePrompt(pedido, { intent_summary: "pizza" }, IDENTIDADE, {
      productNames: ["Pizza de queijo"],
    });
    assert.match(prompt, /pizza de queijo/i);
    assert.match(prompt, /Do NOT replace it with a different version suggested by its name/);
  });
});
