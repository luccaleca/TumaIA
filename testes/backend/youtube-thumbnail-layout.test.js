import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  looksLikeYoutubePointerThumbnail,
  youtubePointerThumbnailPromptBlock,
} from "../../backend/src/services/youtubeThumbnailLayout.js";

describe("youtubeThumbnailLayout", () => {
  it("detecta thumbnail YouTube com seta", () => {
    assert.equal(
      looksLikeYoutubePointerThumbnail(
        "Thumbnail YouTube 16:9 curiosidades, título amarelo no topo e seta apontando pro detalhe",
      ),
      true,
    );
  });

  it("não detecta post Instagram comum", () => {
    assert.equal(
      looksLikeYoutubePointerThumbnail("Post promocional Instagram whey 1 por 99,99"),
      false,
    );
  });

  it("exige cauda da seta encostando no título", () => {
    const block = youtubePointerThumbnailPromptBlock({ fraseNaImagem: "E OS INSETOS?" });
    assert.match(block, /CAUDA da seta encosta/i);
    assert.match(block, /zero espaço vazio/i);
    assert.match(block, /E OS INSETOS\?/);
  });
});
