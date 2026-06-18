import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildWagnerPostImageMockResult,
  isWagnerPostImageMock,
  WAGNER_MOCK_IMAGE_URL,
} from "../../frontend/lib/devChatShortcuts.js";

describe("devChatShortcuts / wagner", () => {
  it("detecta atalho wagner sem abrir fluxo de briefing", () => {
    assert.equal(isWagnerPostImageMock("wagner"), true);
    assert.equal(isWagnerPostImageMock("Wagner!"), true);
    assert.equal(isWagnerPostImageMock("wagners"), false);
    assert.equal(isWagnerPostImageMock("fala wagner"), false);
  });

  it("monta prévia fictícia com URL local e botões pós-imagem", () => {
    const out = buildWagnerPostImageMockResult();
    assert.equal(out.ok, true);
    assert.deepEqual(out.urls, [WAGNER_MOCK_IMAGE_URL]);
    assert.equal(out.model, "dev/wagner");
  });
});
