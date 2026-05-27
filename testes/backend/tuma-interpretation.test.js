import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isMetaOrHypotheticalQuestion,
  hasExplicitCreateRequest,
  mentionsVisualTopic,
} from "../../backend/src/services/tumaInterpretation.js";

describe("tumaInterpretation", () => {
  it("cita postagem sem pedido de execução", () => {
    const q = "se eu fazer um pedido de uma postagem vc me ajuda?";
    assert.equal(mentionsVisualTopic(q), true);
    assert.equal(isMetaOrHypotheticalQuestion(q), true);
    assert.equal(hasExplicitCreateRequest(q), false);
  });

  it("pedido com verbo imperativo", () => {
    assert.equal(hasExplicitCreateRequest("quero fazer um post hoje"), true);
    assert.equal(hasExplicitCreateRequest("bora montar uma arte"), true);
  });
});
