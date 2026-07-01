import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chatImageStoragePrefix,
  extractImageStoragePathsFromMeta,
} from "../../backend/src/services/chatGeneratedImageStorage.js";

describe("chatGeneratedImageStorage", () => {
  it("monta prefixo por empresa e conversa", () => {
    const emp = "065073fb-3b0f-45eb-855e-baabb831bf39";
    const conv = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    assert.equal(chatImageStoragePrefix(emp, conv), `${emp}/_chat/${conv}`);
  });

  it("extrai paths do metadados da mensagem", () => {
    const paths = extractImageStoragePathsFromMeta({
      image_storage_paths: ["emp/_chat/conv/a.png", "  ", ""],
    });
    assert.deepEqual(paths, ["emp/_chat/conv/a.png"]);
  });
});
