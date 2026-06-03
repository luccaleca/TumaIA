import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateGptImage2ReferencesReady } from "../../backend/src/services/gptImage2ReferenceStatus.js";

describe("evaluateGptImage2ReferencesReady", () => {
  it("bloqueia modo integrado quando há produtos mas zero URLs", () => {
    const s = evaluateGptImage2ReferencesReady(
      { productRefIds: ["p1", "p2"], inputImages: undefined, logoInReferences: true },
      { integrated: true },
    );
    assert.equal(s.blocked, true);
    assert.equal(s.ready, false);
    assert.equal(s.missing_midia_urls, true);
    assert.match(String(s.block_reason), /URLs indisponíveis/i);
  });

  it("libera quando não há produtos no pedido", () => {
    const s = evaluateGptImage2ReferencesReady(
      { productRefIds: [], inputImages: undefined },
      { integrated: true },
    );
    assert.equal(s.blocked, false);
    assert.equal(s.missing_midia_urls, false);
  });

  it("libera quando há URLs para todos os produtos", () => {
    const s = evaluateGptImage2ReferencesReady(
      { productRefIds: ["p1"], inputImages: ["https://x/a.png"], logoInReferences: false },
      { integrated: true },
    );
    assert.equal(s.blocked, false);
    assert.equal(s.reference_png_count, 1);
  });
});
