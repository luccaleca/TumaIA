import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { extractBrandPaletteFromBuffer } from "../../backend/src/services/imagePaletteExtract.js";

describe("imagePaletteExtract", () => {
  it("extrai duas cores distintas de imagem bicolor", async () => {
    const redHalf = await sharp({
      create: { width: 80, height: 80, channels: 3, background: { r: 227, g: 27, b: 35 } },
    })
      .png()
      .toBuffer();
    const blueHalf = await sharp({
      create: { width: 80, height: 80, channels: 3, background: { r: 0, g: 82, b: 165 } },
    })
      .png()
      .toBuffer();
    const combined = await sharp({
      create: { width: 160, height: 80, channels: 3, background: { r: 227, g: 27, b: 35 } },
    })
      .composite([{ input: blueHalf, left: 80, top: 0 }])
      .png()
      .toBuffer();

    const palette = await extractBrandPaletteFromBuffer(combined);
    assert.ok(palette.primary?.startsWith("#"));
    assert.ok(palette.secondary?.startsWith("#"));
    assert.notEqual(palette.primary, palette.secondary);
  });
});
