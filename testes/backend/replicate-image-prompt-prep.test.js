import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import {
  LOGO_IMAGE_PROMPT_CANVAS_PX,
  LOGO_IMAGE_PROMPT_MAX_FRACTION,
  REPLICATE_IMAGE_PROMPT_MIN_PX,
  compositeBrandLogoForImagePrompt,
  dimensionsForReplicateImagePrompt,
  friendlyImageGenerationError,
} from "../../backend/src/services/replicateImagePromptPrep.js";

describe("replicateImagePromptPrep", () => {
  it("não altera dimensões já válidas", () => {
    const d = dimensionsForReplicateImagePrompt(800, 600);
    assert.equal(d.needsResize, false);
    assert.equal(d.width, 800);
    assert.equal(d.height, 600);
  });

  it("amplia thumbnail para pelo menos 256px em cada lado", () => {
    const d = dimensionsForReplicateImagePrompt(120, 80);
    assert.equal(d.needsResize, true);
    assert.ok(d.width >= REPLICATE_IMAGE_PROMPT_MIN_PX);
    assert.ok(d.height >= REPLICATE_IMAGE_PROMPT_MIN_PX);
    const ratio = 120 / 80;
    assert.ok(Math.abs(d.width / d.height - ratio) < 0.02);
  });

  it("logo pequeno no centro de canvas 512 (não preenche o quadro)", async () => {
    const tiny = await sharp({
      create: { width: 140, height: 140, channels: 3, background: { r: 50, g: 200, b: 50 } },
    })
      .png()
      .toBuffer();
    const out = await compositeBrandLogoForImagePrompt(tiny);
    const meta = await sharp(out).metadata();
    assert.equal(meta.width, LOGO_IMAGE_PROMPT_CANVAS_PX);
    assert.equal(meta.height, LOGO_IMAGE_PROMPT_CANVAS_PX);
    const logoMax = Math.floor(LOGO_IMAGE_PROMPT_CANVAS_PX * LOGO_IMAGE_PROMPT_MAX_FRACTION);
    assert.ok((meta.width ?? 0) > logoMax);
  });

  it("mensagem amigável para erro de dimensão", () => {
    const msg = friendlyImageGenerationError(
      "Failed to generate: Image_prompt dimensions must be at least 256x256 pixels",
    );
    assert.match(msg, /muito pequena|256/i);
    assert.doesNotMatch(msg, /Replicate/i);
  });
});
