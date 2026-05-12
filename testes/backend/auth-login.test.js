import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginBody } from "../../backend/src/modules/auth/registerPayload.schema.js";

describe("auth login — loginBody (POST /auth/login)", () => {
  it("aceita e-mail e senha válidos e normaliza e-mail", () => {
    const r = loginBody.safeParse({
      email: "  User@DOMINIO.COM  ",
      senha: "qualquer-senha",
    });
    assert.equal(r.success, true);
    assert.equal(r.data.email, "user@dominio.com");
    assert.equal(r.data.senha, "qualquer-senha");
  });

  it("aplica trim na senha (mesma regra do cadastro)", () => {
    const r = loginBody.safeParse({
      email: "a@b.co",
      senha: "  segredo  ",
    });
    assert.equal(r.success, true);
    assert.equal(r.data.senha, "segredo");
  });

  it("aceita senha de um caractere após trim", () => {
    const r = loginBody.safeParse({
      email: "x@y.co",
      senha: " x ",
    });
    assert.equal(r.success, true);
    assert.equal(r.data.senha, "x");
  });

  it("rejeita senha vazia após trim", () => {
    const r = loginBody.safeParse({
      email: "ok@exemplo.com",
      senha: "   ",
    });
    assert.equal(r.success, false);
  });

  it("rejeita senha com mais de 128 caracteres", () => {
    const r = loginBody.safeParse({
      email: "ok@exemplo.com",
      senha: "a".repeat(129),
    });
    assert.equal(r.success, false);
  });

  it("aceita senha com exatamente 128 caracteres", () => {
    const r = loginBody.safeParse({
      email: "ok@exemplo.com",
      senha: "a".repeat(128),
    });
    assert.equal(r.success, true);
    assert.equal(r.data.senha.length, 128);
  });

  it("rejeita e-mail inválido", () => {
    const r = loginBody.safeParse({
      email: "sem-arroba",
      senha: "12345678",
    });
    assert.equal(r.success, false);
  });

  it("rejeita payload sem senha", () => {
    const r = loginBody.safeParse({
      email: "ok@exemplo.com",
    });
    assert.equal(r.success, false);
  });

  it("rejeita payload sem e-mail", () => {
    const r = loginBody.safeParse({
      senha: "abc",
    });
    assert.equal(r.success, false);
  });
});
