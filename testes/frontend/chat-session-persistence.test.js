import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chatSessionStorageKey,
  saveChatSession,
  loadChatSession,
  clearChatSession,
} from "../../frontend/lib/chatSessionPersistence.js";

describe("chatSessionPersistence", () => {
  it("round-trip em sessionStorage simulado", () => {
    const store = new Map();
    const empresaId = "065073fb-3b0f-45eb-855e-baabb831bf39";
    globalThis.sessionStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    };

    saveChatSession(empresaId, {
      conversaId: empresaId,
      input: "texto que estava digitando",
      messages: [{ id: "1", role: "user", content: "oi" }],
    });

    const loaded = loadChatSession(empresaId);
    assert.equal(loaded?.input, "texto que estava digitando");
    assert.equal(loaded?.messages?.length, 1);
    assert.ok(store.has(chatSessionStorageKey(empresaId)));

    clearChatSession(empresaId);
    assert.equal(loadChatSession(empresaId), null);
  });
});
