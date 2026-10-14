import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildIntegratedProductImagePrompt } from "../../backend/src/services/imagePreviewPrompt.js";

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
