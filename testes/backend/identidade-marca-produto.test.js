import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatBrandIdentityForProductPrompt,
  nomeAproximadoDaCor,
} from "../../backend/src/modules/empresas/identidadeMarca.js";

const IDENTIDADE = {
  nome_fantasia: "Way Beer",
  cor_primaria: "#1E6FFF",
  cor_secundaria: "#000000",
  estilo_visual: "Moderno e marcante, fundo escuro, iluminação de estúdio",
  evitar: "espuma exagerada; pessoas bebendo",
};

describe("nomeAproximadoDaCor", () => {
  it("nomeia as cores básicas", () => {
    assert.equal(nomeAproximadoDaCor("#000000"), "black");
    assert.equal(nomeAproximadoDaCor("#FFFFFF"), "white");
    assert.equal(nomeAproximadoDaCor("#1E6FFF"), "blue");
    assert.equal(nomeAproximadoDaCor("#E53935"), "red");
    assert.equal(nomeAproximadoDaCor("#2E7D32"), "green");
    assert.equal(nomeAproximadoDaCor("#FFC107"), "yellow");
    assert.equal(nomeAproximadoDaCor("#808080"), "gray");
  });

  it("distingue tom escuro, claro e marrom", () => {
    assert.equal(nomeAproximadoDaCor("#0A1F44"), "dark blue");
    assert.equal(nomeAproximadoDaCor("#8B5A2B"), "brown");
    assert.match(nomeAproximadoDaCor("#9ECBFF"), /light blue/);
  });

  it("valor inválido devolve vazio", () => {
    assert.equal(nomeAproximadoDaCor("azul"), "");
    assert.equal(nomeAproximadoDaCor(""), "");
  });
});

describe("formatBrandIdentityForProductPrompt", () => {
  it("leva as cores (com nome), o estilo e o que evitar", () => {
    const bloco = formatBrandIdentityForProductPrompt(IDENTIDADE);
    assert.match(bloco, /blue \(#1E6FFF\)/i);
    assert.match(bloco, /black \(#000000\)/i);
    assert.match(bloco, /Moderno e marcante/);
    assert.match(bloco, /espuma exagerada/);
  });

  it("as cores valem para o cenário e nunca para a embalagem; a marca vence o pedido", () => {
    const bloco = formatBrandIdentityForProductPrompt(IDENTIDADE);
    assert.match(bloco, /NEVER changes the product packaging/);
    assert.match(bloco, /brand identity wins/);
    assert.doesNotMatch(bloco, /Proibido cores fora/i);
  });

  it("não passa do limite e usa o veto padrão quando «evitar» está vazio", () => {
    const bloco = formatBrandIdentityForProductPrompt({ ...IDENTIDADE, evitar: "", estilo_visual: "x".repeat(2000) });
    assert.ok(bloco.length <= 1100);
    assert.match(bloco, /Avoid:/);
  });

  it("texto que já termina em ponto não gera «..»", () => {
    const bloco = formatBrandIdentityForProductPrompt({ ...IDENTIDADE, evitar: "espuma exagerada; rótulo diferente do original." });
    assert.doesNotMatch(bloco, /\.\./);
    assert.match(bloco, /Avoid: espuma exagerada; rótulo diferente do original\./);
  });
});
