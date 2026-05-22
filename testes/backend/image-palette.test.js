import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { extractBrandPaletteFromBuffer } from "../../backend/src/services/imagePaletteExtract.js";

describe("imagePaletteExtract", () => {
  it("extrai paleta de imagem com verde e azul", async () => {
    const greenHalf = await sharp({
      create: { width: 80, height: 80, channels: 3, background: { r: 0, g: 230, b: 118 } },
    })
      .png()
      .toBuffer();
    const blueHalf = await sharp({
      create: { width: 80, height: 80, channels: 3, background: { r: 15, g: 23, b: 42 } },
    })
      .png()
      .toBuffer();
    const combined = await sharp({
      create: { width: 160, height: 80, channels: 3, background: { r: 0, g: 230, b: 118 } },
    })
      .composite([{ input: blueHalf, left: 80, top: 0 }])
      .png()
      .toBuffer();

    const palette = await extractBrandPaletteFromBuffer(combined);
    assert.ok(palette.primary?.startsWith("#"));
    const ranked = [palette.primary, palette.secondary, ...palette.accents].filter(Boolean);
    assert.ok(ranked.length >= 1);
  });

  it("accents é array (pode estar vazio em imagens muito simples)", async () => {
    const buf = await sharp({
      create: { width: 120, height: 80, channels: 3, background: { r: 0, g: 230, b: 118 } },
    })
      .png()
      .toBuffer();
    const palette = await extractBrandPaletteFromBuffer(buf);
    assert.ok(Array.isArray(palette.accents));
    assert.ok(palette.primary?.startsWith("#"));
  });
});
