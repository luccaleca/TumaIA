import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { putEmpresaAtivaBody } from "../../backend/src/modules/auth/usuarioEmpresaUltimaService.js";

describe("usuarioEmpresaUltima — putEmpresaAtivaBody", () => {
  it("aceita uuid", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const r = putEmpresaAtivaBody.safeParse({ id_empresa: id });
    assert.equal(r.success, true);
    assert.equal(r.data.id_empresa, id);
  });

  it("aceita null para limpar", () => {
    const r = putEmpresaAtivaBody.safeParse({ id_empresa: null });
    assert.equal(r.success, true);
    assert.equal(r.data.id_empresa, null);
  });

  it("rejeita uuid inválido", () => {
    const r = putEmpresaAtivaBody.safeParse({ id_empresa: "nao-uuid" });
    assert.equal(r.success, false);
  });
});
