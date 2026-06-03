import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProductLayoutSlots,
  COMPOSE_HERO_MAX_WIDTH_FRACTION,
  COMPOSE_HERO_SIZE_BOOST,
  COMPOSE_LOGO_FRAME_FRACTION,
  COMPOSE_LOGO_MAX_PX,
  COMPOSE_LOGO_MIN_PX,
  COMPOSE_SUPPORT_SIZE_BOOST,
  pickLogoWatermarkCorner,
  resolveProductLayerTargetWidth,
} from "../../backend/src/services/productSceneComposer.js";
import { buildRawImagePrompt } from "../../backend/src/services/imagePreviewPrompt.js";
import { formatBrandIdentityForRawPrompt } from "../../backend/src/modules/empresas/identidadeMarca.js";

describe("etapa 5 — composição final (PNG + logo)", () => {
  it("constantes de escala priorizam hero e logo discreta no canto", () => {
    assert.ok(COMPOSE_HERO_SIZE_BOOST >= 1.25 && COMPOSE_HERO_SIZE_BOOST <= 1.45);
    assert.ok(COMPOSE_SUPPORT_SIZE_BOOST >= 1.05 && COMPOSE_SUPPORT_SIZE_BOOST <= 1.2);
    assert.ok(COMPOSE_HERO_MAX_WIDTH_FRACTION >= 0.4 && COMPOSE_HERO_MAX_WIDTH_FRACTION <= 0.48);
    assert.ok(COMPOSE_LOGO_FRAME_FRACTION >= 0.06 && COMPOSE_LOGO_FRAME_FRACTION <= 0.11);
    assert.ok(COMPOSE_LOGO_MIN_PX >= 40 && COMPOSE_LOGO_MIN_PX <= 60);
    assert.ok(COMPOSE_LOGO_MAX_PX >= 72 && COMPOSE_LOGO_MAX_PX <= 100);
  });

  it("produto único em quadrado usa slot largo (hero dominante)", () => {
    const slots = buildProductLayoutSlots(1, 1080, 1080);
    assert.equal(slots.length, 1);
    assert.ok(slots[0].width >= 0.48);
    const targetPx = resolveProductLayerTargetWidth(1080, slots[0].width, true);
    assert.ok(targetPx <= 1080 * COMPOSE_HERO_MAX_WIDTH_FRACTION + 2);
    assert.ok(targetPx >= 1080 * 0.38, "hero visível mas sem dominar o quadro");
  });

  it("três produtos deixam o centro maior que as laterais", () => {
    const slots = buildProductLayoutSlots(3, 1024, 1024);
    assert.equal(slots.length, 3);
    assert.ok(slots[1].width > slots[0].width);
    assert.ok(slots[1].width > slots[2].width);
    assert.ok(slots[1].width >= 0.3 && slots[1].width <= 0.38);
    const heroPx = resolveProductLayerTargetWidth(1024, slots[1].width, true);
    const sidePx = resolveProductLayerTargetWidth(1024, slots[0].width, false);
    assert.ok(heroPx > sidePx);
    assert.ok(heroPx <= 1024 * COMPOSE_HERO_MAX_WIDTH_FRACTION + 2);
  });

  it("logo em 1080px fica discreta (~7–9% do lado menor, teto em px)", () => {
    const frame = 1080;
    const target = Math.min(
      COMPOSE_LOGO_MAX_PX,
      Math.max(COMPOSE_LOGO_MIN_PX, Math.round(frame * COMPOSE_LOGO_FRAME_FRACTION)),
    );
    assert.ok(target >= Math.round(frame * 0.06));
    assert.ok(target <= Math.round(frame * 0.1));
  });

  it("vários produtos: logo no canto inferior esquerdo", () => {
    assert.equal(pickLogoWatermarkCorner(3), "bl");
    assert.equal(pickLogoWatermarkCorner(1), "br");
  });

  it("prompt raw descreve logo como marca d'água depois da geração", () => {
    const p = buildRawImagePrompt(
      [{ role: "user", content: "promoção monster" }],
      { intent_summary: "promo monster" },
      { id_midia_logo: "logo-uuid", estilo_visual: "energético" },
      { composeProductAssets: true, productCount: 3 },
    );
    assert.match(p, /marca d['']água|watermark|7–9%/i);
    assert.match(p, /não desenhe logo|foco/i);
    assert.match(p, /terço superior|PNG dos produtos/i);
  });

  it("bloco de identidade pede marca d'água", () => {
    const block = formatBrandIdentityForRawPrompt({ id_midia_logo: "x", estilo_visual: "moderno" });
    assert.match(block, /marca d['']água|7–9%|semitransparente/i);
  });
});
