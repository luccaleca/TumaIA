import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contaIniciais,
  formatarDataContaPtBr,
  montarBodyPatchConta,
  validarContaForm,
} from "../../frontend/lib/contaProfile.js";

describe("conta — contaIniciais", () => {
  it("usa duas letras do nome quando possível", () => {
    assert.equal(contaIniciais("Maria Silva", "m@x.com"), "MA");
  });

  it("usa uma letra do nome se só houver uma", () => {
    assert.equal(contaIniciais("A", "b@c.com"), "A");
  });

  it("cai no e-mail se nome vazio", () => {
    assert.equal(contaIniciais("", "joao@exemplo.com"), "JO");
  });

  it("retorna ? se não houver dados úteis", () => {
    assert.equal(contaIniciais("", ""), "?");
    assert.equal(contaIniciais("  ", " x"), "?");
  });
});

describe("conta — formatarDataContaPtBr", () => {
  it("retorna null para vazio ou inválido", () => {
    assert.equal(formatarDataContaPtBr(""), null);
    assert.equal(formatarDataContaPtBr("   "), null);
    assert.equal(formatarDataContaPtBr("não é data"), null);
  });

  it("formata ISO válido em pt-BR", () => {
    const s = formatarDataContaPtBr("2024-06-15T12:00:00.000Z");
    assert.ok(typeof s === "string" && s.length > 0);
    assert.match(s, /2024/);
  });
});

describe("conta — validarContaForm", () => {
  it("rejeita nome ou e-mail vazio", () => {
    const a = validarContaForm({
      nome: "",
      email: "a@b.co",
      telefone: "11999999999",
    });
    assert.equal(a.ok, false);
    const b = validarContaForm({
      nome: "Ana",
      email: "  ",
      telefone: "11999999999",
    });
    assert.equal(b.ok, false);
  });

  it("rejeita telefone com mais de 20 caracteres", () => {
    const r = validarContaForm({
      nome: "Ana",
      email: "ana@exemplo.com",
      telefone: "1".repeat(21),
    });
    assert.equal(r.ok, false);
  });

  it("rejeita telefone vazio ou curto", () => {
    const a = validarContaForm({
      nome: "Ana",
      email: "ana@exemplo.com",
      telefone: "",
    });
    assert.equal(a.ok, false);
    const b = validarContaForm({
      nome: "Ana",
      email: "ana@exemplo.com",
      telefone: "123",
    });
    assert.equal(b.ok, false);
  });

  it("aceita telefone válido e normaliza e-mail", () => {
    const r = validarContaForm({
      nome: " Ana ",
      email: "  Ana@Exemplo.COM  ",
      telefone: "(11) 99999-9999",
    });
    assert.equal(r.ok, true);
    assert.equal(r.nome, "Ana");
    assert.equal(r.email, "ana@exemplo.com");
    assert.equal(r.telefone, "(11) 99999-9999");
  });
});

describe("conta — montarBodyPatchConta", () => {
  it("monta corpo com telefone obrigatório", () => {
    const r = montarBodyPatchConta({
      nome: "Ana",
      email: "ana@exemplo.com",
      telefone: "11999999999",
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.body, {
      nome: "Ana",
      email: "ana@exemplo.com",
      telefone: "11999999999",
    });
  });

  it("rejeita telefone vazio", () => {
    const r = montarBodyPatchConta({
      nome: "Ana",
      email: "ana@exemplo.com",
      telefone: "  ",
    });
    assert.equal(r.ok, false);
    assert.ok(typeof r.message === "string");
  });

  it("propaga erro de validação", () => {
    const r = montarBodyPatchConta({
      nome: "",
      email: "x@y.z",
      telefone: "11999999999",
    });
    assert.equal(r.ok, false);
    assert.ok(typeof r.message === "string");
  });
});
