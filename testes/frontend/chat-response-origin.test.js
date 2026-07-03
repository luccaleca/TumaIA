import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assistantBubbleSurfaceClass,
  isCursorChatMessage,
  isInstructionChatMessage,
} from "../../frontend/lib/chatResponseOrigin.js";

describe("chatResponseOrigin", () => {
  it("identifica resposta Cursor", () => {
    assert.equal(isCursorChatMessage({ chat_source: "cursor" }), true);
    assert.equal(isCursorChatMessage({ chat_engine: "cursor_agent" }), true);
    assert.equal(isCursorChatMessage({ chat_route: "cursor_agent_raw" }), true);
    assert.equal(isCursorChatMessage({ chat_route: "cursor_agent_session" }), true);
    assert.equal(isInstructionChatMessage({ chat_route: "cursor_agent_raw" }), false);
  });

  it("identifica resposta por instruções", () => {
    assert.equal(isInstructionChatMessage({ chat_route: "conversa_natural" }), true);
    assert.equal(isInstructionChatMessage({ chat_route: "acervo" }), true);
    assert.equal(isInstructionChatMessage({ chat_route: "node_llm_light" }), false);
  });

  it("aplica classes de cor", () => {
    assert.match(assistantBubbleSurfaceClass({ chat_source: "cursor" }), /bg-blue-50/);
    assert.match(assistantBubbleSurfaceClass({ chat_route: "identity" }), /bg-red-50/);
    assert.match(assistantBubbleSurfaceClass({ chat_route: "llm_rag" }), /bg-background/);
  });
});
