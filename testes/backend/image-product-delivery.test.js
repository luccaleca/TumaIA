import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getImageProductMode,
  usesGptIntegratedProducts,
  usesGptRefineAfterCollage,
  usesSharpProductCollage,
} from "../../backend/src/services/imageProductDelivery.js";
import {
  buildIntegratedProductImagePrompt,
  buildRefineComposedImagePrompt,
} from "../../backend/src/services/imagePreviewPrompt.js";

describe("image product delivery modes", () => {
  it("gpt_integrated: produtos vão ao GPT, sem collage Sharp", () => {
    assert.equal(usesGptIntegratedProducts("gpt_integrated"), true);
    assert.equal(usesSharpProductCollage("gpt_integrated"), false);
    assert.equal(usesGptRefineAfterCollage("gpt_integrated"), false);
  });

  it("collage_refine: Sharp depois refinamento", () => {
    assert.equal(usesSharpProductCollage("collage_refine"), true);
    assert.equal(usesGptRefineAfterCollage("collage_refine"), true);
    assert.equal(usesGptIntegratedProducts("collage_refine"), false);
  });

  it("prompt integrado cita referências e preservação de embalagem", () => {
    const p = buildIntegratedProductImagePrompt(
      [{ role: "user", content: "post pro force com 50% off" }],
      { intent_summary: "promo infantil" },
      { estilo_visual: "energético" },
      { productNames: ["pro force chocolate", "pro force morango"] },
    );
    assert.match(p, /reference pictures/i);
    assert.match(p, /pro force chocolate/i);
    assert.match(p, /Preserve the exact packaging/i);
    assert.doesNotMatch(p, /MODO FUNDO PARA COLAGEM/i);
  });

  it("prompt refine pede harmonizar sem mover produtos", () => {
    const p = buildRefineComposedImagePrompt({
      pedido: "promo pro force",
      fraseNaImagem: "50% OFF",
    });
    assert.match(p, /harmon/i);
    assert.match(p, /não redimensione nem mova/i);
  });

  it("modo padrão é gpt_integrated", () => {
    assert.equal(getImageProductMode(), "gpt_integrated");
  });
});
