import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAdminTumaCoreEmpresa } from "../../frontend/lib/tumacoreEmpresa.js";

describe("frontend tumacoreEmpresa", () => {
  it("reconhece administrador", () => {
    assert.equal(
      isAdminTumaCoreEmpresa([{ papel: "administrador", empresa: { id_empresa: "a" } }]),
      true,
    );
  });

  it("nega editor/membro", () => {
    assert.equal(isAdminTumaCoreEmpresa([{ papel: "editor" }]), false);
    assert.equal(isAdminTumaCoreEmpresa([{ papel: "membro" }]), false);
    assert.equal(isAdminTumaCoreEmpresa([]), false);
  });
});
