import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { env } from "../../backend/src/config.js";
import { shouldUseNodeChat } from "../../backend/src/services/processChatMessage.js";

describe("shouldUseNodeChat (protótipo sem RAG)", () => {
  it("padrão do protótipo: TUMAIA_NODE_CHAT habilita Node", () => {
    assert.equal(typeof env.TUMAIA_NODE_CHAT, "boolean");
    // Com .env de TCC ou sem override, o caminho feliz é Node.
    if (env.TUMAIA_NODE_CHAT) {
      assert.equal(shouldUseNodeChat({}), true);
    }
  });

  it("fast_path explícito sempre usa Node", () => {
    assert.equal(shouldUseNodeChat({ fast_path: true }), true);
  });

  it("provider cursor força Node (sem Python)", () => {
    if (env.CHAT_LLM_PROVIDER === "cursor") {
      assert.equal(shouldUseNodeChat({}), true);
    }
  });
});
