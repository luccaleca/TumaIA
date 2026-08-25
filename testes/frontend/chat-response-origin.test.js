import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assistantBubbleSurfaceClass,
  isCloudChatMessage,
  isInstructionChatMessage,
} from "../../frontend/lib/chatResponseOrigin.js";

describe("chatResponseOrigin", () => {
  it("identifica resposta cloud", () => {
    assert.equal(isCloudChatMessage({ chat_source: "cloud" }), true);
    assert.equal(isCloudChatMessage({ chat_engine: "cloud_agent" }), true);
    assert.equal(isCloudChatMessage({ chat_route: "cloud_agent_raw" }), true);
    assert.equal(isCloudChatMessage({ chat_route: "cloud_agent_session" }), true);
    assert.equal(isInstructionChatMessage({ chat_route: "cloud_agent_raw" }), false);
  });

  it("identifica resposta de instrução", () => {
    assert.equal(isInstructionChatMessage({ chat_route: "identity" }), true);
    assert.equal(isInstructionChatMessage({ chat_route: "acervo" }), true);
  });

  it("pinta bolha cloud de azul", () => {
    assert.match(assistantBubbleSurfaceClass({ chat_source: "cloud" }), /bg-blue-50/);
  });
});
