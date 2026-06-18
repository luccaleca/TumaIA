import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeSenhaInput,
  registerBody,
} from "../../backend/src/modules/auth/registerPayload.schema.js";

describe("auth cadastro — normalizeSenhaInput", () => {
  it("aplica NFC e remove espaços nas pontas", () => {
    assert.equal(normalizeSenhaInput("  abc  "), "abc");
  });

  it("não altera não-string", () => {
    assert.equal(normalizeSenhaInput(null), null);
    assert.equal(normalizeSenhaInput(1), 1);
  });
});

describe("auth cadastro — registerBody (POST /auth/register)", () => {
  it("aceita payload válido com telefone", () => {
    const r = registerBody.safeParse({
      nome: "Maria",
      email: "Maria@EXEMPLO.com",
      senha: "senha1234",
      telefone: "(11) 99988-7766",
    });
    assert.equal(r.success, true);
    assert.equal(r.data.email, "maria@exemplo.com");
    assert.equal(r.data.nome, "Maria");
    assert.equal(r.data.senha, "senha1234");
    assert.equal(r.data.telefone, "11999887766");
  });

  it("rejeita cadastro sem telefone", () => {
    const a = registerBody.safeParse({
      nome: "João",
      email: "j@exemplo.com",
      senha: "12345678",
    });
    assert.equal(a.success, false);

    const b = registerBody.safeParse({
      nome: "João",
      email: "j2@exemplo.com",
      senha: "12345678",
      telefone: null,
    });
    assert.equal(b.success, false);
  });

  it("aceita telefone preenchido", () => {
    const b = registerBody.safeParse({
      nome: "João",
      email: "j2@exemplo.com",
      senha: "12345678",
      telefone: "11999998888",
    });
    assert.equal(b.success, true);
    assert.equal(b.data.telefone, "11999998888");
  });

  it("rejeita senha com menos de 8 caracteres após trim", () => {
    const r = registerBody.safeParse({
      nome: "A",
      email: "a@b.co",
      senha: "  12345  ",
    });
    assert.equal(r.success, false);
  });

  it("rejeita email inválido", () => {
    const r = registerBody.safeParse({
      nome: "A",
      email: "nao-email",
      senha: "12345678",
    });
    assert.equal(r.success, false);
  });

  it("rejeita nome vazio", () => {
    const r = registerBody.safeParse({
      nome: "",
      email: "ok@exemplo.com",
      senha: "12345678",
    });
    assert.equal(r.success, false);
  });

  it("rejeita nome com mais de 150 caracteres", () => {
    const r = registerBody.safeParse({
      nome: "x".repeat(151),
      email: "ok@exemplo.com",
      senha: "12345678",
    });
    assert.equal(r.success, false);
  });

  it("rejeita telefone com mais de 20 caracteres", () => {
    const r = registerBody.safeParse({
      nome: "A",
      email: "ok@exemplo.com",
      senha: "12345678",
      telefone: "1".repeat(21),
    });
    assert.equal(r.success, false);
  });
});
