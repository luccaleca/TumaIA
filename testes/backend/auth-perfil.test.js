import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patchMeBody, registerBody } from "../../backend/src/modules/auth/registerPayload.schema.js";

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

  it("rejeita telefone null", () => {
    const r = patchMeBody.safeParse({ telefone: null });
    assert.equal(r.success, false);
  });

  it("aceita só email e normaliza", () => {
    const r = patchMeBody.safeParse({ email: "  NOVO@Mail.COM " });
    assert.equal(r.success, true);
    assert.equal(r.data.email, "novo@mail.com");
  });

  it("aceita combinação de campos", () => {
    const r = patchMeBody.safeParse({
      nome: "A",
      telefone: "11999998888",
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

describe("auth cadastro — registerBody", () => {
  it("exige telefone válido", () => {
    const ok = registerBody.safeParse({
      nome: "Teste",
      email: "a@b.co",
      senha: "12345678",
      telefone: "(11) 99988-7766",
    });
    assert.equal(ok.success, true);
    if (ok.success) assert.equal(ok.data.telefone, "11999887766");

    const bad = registerBody.safeParse({
      nome: "Teste",
      email: "a@b.co",
      senha: "12345678",
      telefone: "",
    });
    assert.equal(bad.success, false);
  });
});
