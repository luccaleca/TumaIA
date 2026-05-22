import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignRankedPalette,
  brandColorScoreHex,
  rankBrandHexColors,
} from "../../backend/src/lib/brandColorScore.js";
import { extractBrandPaletteFromBuffer } from "../../backend/src/services/imagePaletteExtract.js";

describe("brandColorScore", () => {
  it("prioriza cores saturadas de marca sobre marrom de ilustração", () => {
    const ranked = rankBrandHexColors(["#8B5E3C", "#E31B23", "#0F172A", "#FFFFFF"]);
    assert.equal(ranked[0], "#E31B23");
    assert.ok(ranked.includes("#0F172A"));
    assert.ok(brandColorScoreHex("#8B5E3C") < brandColorScoreHex("#E31B23"));
  });

  it("assignRankedPalette ordena paleta completa", () => {
    const p = assignRankedPalette(["#A67C52", "#C41E3A", "#1E293B", "#F8FAFC"]);
    assert.equal(p.cor_primaria, "#C41E3A");
    assert.equal(p.cor_secundaria, "#1E293B");
    assert.ok(p.cores_adicionais.includes("#F8FAFC"));
  });
});

describe("extractBrandPalette — sintético mascote + marca", () => {
  it("verde e navy ficam acima do marrom do mascote", async () => {
    const sharp = (await import("sharp")).default;
    const mascotBrown = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 160, g: 110, b: 72 } },
    })
      .png()
      .toBuffer();
    const logoGreen = await sharp({
      create: { width: 120, height: 40, channels: 3, background: { r: 0, g: 230, b: 118 } },
    })
      .png()
      .toBuffer();
    const textNavy = await sharp({
      create: { width: 120, height: 40, channels: 3, background: { r: 15, g: 23, b: 42 } },
    })
      .png()
      .toBuffer();
    const canvas = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 248, g: 250, b: 252 } },
    })
      .composite([
        { input: mascotBrown, left: 0, top: 0 },
        { input: logoGreen, left: 40, top: 20 },
        { input: textNavy, left: 40, top: 120 },
      ])
      .png()
      .toBuffer();

    const pal = await extractBrandPaletteFromBuffer(canvas);
    const merged = assignRankedPalette([pal.primary, pal.secondary, ...pal.accents].filter(Boolean));
    assert.ok(brandColorScoreHex(merged.cor_primaria) > brandColorScoreHex("#A06E48"));
    assert.ok(
      merged.cor_primaria === "#00E676" ||
        merged.cor_secundaria === "#00E676" ||
        merged.cores_adicionais.includes("#00E676"),
    );
  });
});
