import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { env, isCloudChatLlm } from "../../backend/src/config.js";
import { shouldUseNodeChat } from "../../backend/src/services/processChatMessage.js";

describe("shouldUseNodeChat", () => {
  it("TUMAIA_NODE_CHAT habilita Node", () => {
    assert.equal(typeof env.TUMAIA_NODE_CHAT, "boolean");
    if (env.TUMAIA_NODE_CHAT) {
      assert.equal(shouldUseNodeChat({}), true);
    }
  });

  it("fast_path explícito sempre usa Node", () => {
    assert.equal(shouldUseNodeChat({ fast_path: true }), true);
  });

  it("provider cloud força Node (sem Python)", () => {
    if (isCloudChatLlm()) {
      assert.equal(shouldUseNodeChat({}), true);
    }
  });
});
