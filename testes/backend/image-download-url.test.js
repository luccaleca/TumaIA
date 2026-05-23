import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  guessImageDownloadFilename,
  isAllowedImageDownloadUrl,
} from "../../backend/src/services/imageDownloadUrl.js";

describe("imageDownloadUrl", () => {
  it("permite replicate.delivery", () => {
    assert.equal(
      isAllowedImageDownloadUrl("https://replicate.delivery/pbxt/abc/out.png"),
      true,
    );
  });

  it("bloqueia URL arbitrária", () => {
    assert.equal(isAllowedImageDownloadUrl("https://evil.example.com/a.png"), false);
  });

  it("sugere nome de arquivo", () => {
    const name = guessImageDownloadFilename("https://replicate.delivery/x/y.webp");
    assert.match(name, /\.webp$/i);
  });
});
