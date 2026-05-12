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
      telefone: "",
      clearTelefone: false,
    });
    assert.equal(a.ok, false);
    const b = validarContaForm({
      nome: "Ana",
      email: "  ",
      telefone: "",
      clearTelefone: false,
    });
    assert.equal(b.ok, false);
  });

  it("rejeita telefone com mais de 20 caracteres", () => {
    const r = validarContaForm({
      nome: "Ana",
      email: "ana@exemplo.com",
      telefone: "1".repeat(21),
      clearTelefone: false,
    });
    assert.equal(r.ok, false);
  });

  it("aceita telefone vazio e normaliza e-mail", () => {
    const r = validarContaForm({
      nome: " Ana ",
      email: "  Ana@Exemplo.COM  ",
      telefone: "",
      clearTelefone: false,
    });
    assert.equal(r.ok, true);
    assert.equal(r.nome, "Ana");
    assert.equal(r.email, "ana@exemplo.com");
  });
});

describe("conta — montarBodyPatchConta", () => {
  it("monta corpo com telefone null quando clearTelefone", () => {
    const r = montarBodyPatchConta({
      nome: "Ana",
      email: "ana@exemplo.com",
      telefone: "11999999999",
      clearTelefone: true,
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.body, {
      nome: "Ana",
      email: "ana@exemplo.com",
      telefone: null,
    });
  });

  it("omite string vazia de telefone como null", () => {
    const r = montarBodyPatchConta({
      nome: "Ana",
      email: "ana@exemplo.com",
      telefone: "  ",
      clearTelefone: false,
    });
    assert.equal(r.ok, true);
    assert.equal(r.body.telefone, null);
  });

  it("propaga erro de validação", () => {
    const r = montarBodyPatchConta({
      nome: "",
      email: "x@y.z",
      telefone: "",
      clearTelefone: false,
    });
    assert.equal(r.ok, false);
    assert.ok(typeof r.message === "string");
  });
});
