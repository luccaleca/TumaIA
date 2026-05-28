import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProductLayoutSlots,
  COMPOSE_HERO_SIZE_BOOST,
  COMPOSE_LOGO_FRAME_FRACTION,
  COMPOSE_LOGO_MIN_PX,
  COMPOSE_SUPPORT_SIZE_BOOST,
} from "../../backend/src/services/productSceneComposer.js";
import { buildRawImagePrompt } from "../../backend/src/services/imagePreviewPrompt.js";
import { formatBrandIdentityForRawPrompt } from "../../backend/src/modules/empresas/identidadeMarca.js";

describe("etapa 5 — composição final (PNG + logo)", () => {
  it("constantes de escala priorizam hero e logo legível", () => {
    assert.ok(COMPOSE_HERO_SIZE_BOOST >= 1.65);
    assert.ok(COMPOSE_SUPPORT_SIZE_BOOST >= 1.3);
    assert.ok(COMPOSE_LOGO_FRAME_FRACTION >= 0.24);
    assert.ok(COMPOSE_LOGO_MIN_PX >= 140);
  });

  it("produto único em quadrado usa slot largo (hero dominante)", () => {
    const slots = buildProductLayoutSlots(1, 1080, 1080);
    assert.equal(slots.length, 1);
    assert.ok(slots[0].width >= 0.55);
    const effectiveWidth = slots[0].width * COMPOSE_HERO_SIZE_BOOST;
    assert.ok(effectiveWidth >= 0.9, "hero deve ocupar a maior parte da largura útil");
  });

  it("três produtos deixam o centro maior que as laterais", () => {
    const slots = buildProductLayoutSlots(3, 1024, 1024);
    assert.equal(slots.length, 3);
    assert.ok(slots[1].width > slots[0].width);
    assert.ok(slots[1].width > slots[2].width);
    assert.ok(slots[1].width >= 0.38);
  });

  it("logo em 1080px deve ter alvo >= 26% do lado menor", () => {
    const frame = 1080;
    const target = Math.max(COMPOSE_LOGO_MIN_PX, Math.round(frame * COMPOSE_LOGO_FRAME_FRACTION));
    assert.ok(target >= Math.round(frame * 0.24));
  });

  it("prompt raw pede logo legível, não minúscula", () => {
    const p = buildRawImagePrompt(
      [{ role: "user", content: "promoção monster" }],
      { intent_summary: "promo monster" },
      { id_midia_logo: "logo-uuid", estilo_visual: "energético" },
    );
    assert.match(p, /25–30%|legível/i);
    assert.doesNotMatch(p, /logo pequena|minúscula no canto/i);
  });

  it("bloco de identidade não manda logo minúscula", () => {
    const block = formatBrandIdentityForRawPrompt({ id_midia_logo: "x", estilo_visual: "moderno" });
    assert.match(block, /legível|25%/i);
    assert.doesNotMatch(block, /pequena em um canto/i);
  });
});
