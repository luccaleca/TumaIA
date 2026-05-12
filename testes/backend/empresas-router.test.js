import assert from "node:assert/strict";
import { describe, it } from "node:test";
import empresasRouter from "../../backend/src/routes/empresas/index.js";

describe("rotas /empresas", () => {
  it("exporta um Router Express", () => {
    assert.ok(empresasRouter);
    assert.equal(typeof empresasRouter, "function");
    assert.equal(typeof empresasRouter.get, "function");
    assert.equal(typeof empresasRouter.post, "function");
  });
});
