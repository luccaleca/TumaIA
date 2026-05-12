import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patchMeBody } from "../../backend/src/modules/auth/registerPayload.schema.js";

describe("auth perfil — patchMeBody (PATCH /auth/me)", () => {
  it("aceita só nome", () => {
    const r = patchMeBody.safeParse({ nome: "Novo nome" });
    assert.equal(r.success, true);
    assert.equal(r.data.nome, "Novo nome");
  });

  it("aceita só telefone string", () => {
    const r = patchMeBody.safeParse({ telefone: "11988887777" });
    assert.equal(r.success, true);
    assert.equal(r.data.telefone, "11988887777");
  });

  it("aceita só telefone null", () => {
    const r = patchMeBody.safeParse({ telefone: null });
    assert.equal(r.success, true);
    assert.equal(r.data.telefone, null);
  });

  it("aceita só email e normaliza", () => {
    const r = patchMeBody.safeParse({ email: "  NOVO@Mail.COM " });
    assert.equal(r.success, true);
    assert.equal(r.data.email, "novo@mail.com");
  });

  it("aceita combinação de campos", () => {
    const r = patchMeBody.safeParse({
      nome: "A",
      telefone: "11",
      email: "b@c.co",
    });
    assert.equal(r.success, true);
  });

  it("rejeita objeto vazio (nenhum campo)", () => {
    const r = patchMeBody.safeParse({});
    assert.equal(r.success, false);
  });

  it("rejeita .strict: campo desconhecido", () => {
    const r = patchMeBody.safeParse({ nome: "Ok", extra: 1 });
    assert.equal(r.success, false);
  });

  it("rejeita nome vazio quando nome é enviado", () => {
    const r = patchMeBody.safeParse({ nome: "" });
    assert.equal(r.success, false);
  });

  it("rejeita telefone com mais de 20 caracteres", () => {
    const r = patchMeBody.safeParse({ telefone: "1".repeat(21) });
    assert.equal(r.success, false);
  });

  it("rejeita email inválido", () => {
    const r = patchMeBody.safeParse({ email: "nao-e-email" });
    assert.equal(r.success, false);
  });
});
