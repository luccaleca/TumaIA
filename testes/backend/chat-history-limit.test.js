import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { trimChatHistoryForApi, CHAT_API_HISTORY_MAX } from "../../backend/src/services/chatHistoryLimit.js";

describe("trimChatHistoryForApi", () => {
  it("mantém só os últimos turnos", () => {
    const history = Array.from({ length: 100 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg ${i}`,
    }));
    const out = trimChatHistoryForApi(history);
    assert.equal(out.length, CHAT_API_HISTORY_MAX);
    assert.equal(out[0].content, "msg 20");
    assert.equal(out[out.length - 1].content, "msg 99");
  });
});
