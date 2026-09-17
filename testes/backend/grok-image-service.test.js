import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  annotateGrokMultiImagePrompt,
  buildGrokEditImagePayload,
  friendlyGrokImageError,
  urlsFromGrokImageResponse,
} from "../../backend/src/services/grokImageService.js";

describe("grokImageService helpers", () => {
  it("annotateGrokMultiImagePrompt marca IMAGE_n com várias refs", () => {
    const out = annotateGrokMultiImagePrompt("Faça um post do whey.", 3);
    assert.match(out, /<IMAGE_0>/);
    assert.match(out, /<IMAGE_2>/);
    assert.equal(annotateGrokMultiImagePrompt("só texto", 1), "só texto");
  });

  it("buildGrokEditImagePayload usa image ou images", () => {
    assert.deepEqual(buildGrokEditImagePayload(["https://a.png"]), {
      image: { url: "https://a.png", type: "image_url" },
    });
    const multi = buildGrokEditImagePayload(["https://a.png", "https://b.png"]);
    assert.equal(multi.images?.length, 2);
    assert.equal(multi.image, undefined);
  });

  it("urlsFromGrokImageResponse lê url e b64", () => {
    assert.deepEqual(
      urlsFromGrokImageResponse({ data: [{ url: "https://x" }, { b64_json: "a".repeat(120) }] }),
      ["https://x", `data:image/png;base64,${"a".repeat(120)}`],
    );
  });

  it("friendlyGrokImageError mapeia erros comuns", () => {
    assert.match(friendlyGrokImageError("401 unauthorized api key"), /chave.*xai/i);
    assert.match(friendlyGrokImageError("moderation blocked"), /moderação/i);
  });
});
