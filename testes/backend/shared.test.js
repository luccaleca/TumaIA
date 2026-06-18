import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cargoApiDeUsuarioEmpresa,
  createEmpresaBody,
  normalizarCodigo,
  parseJsonIfString,
  perfilAcessoPorCargo,
  podeGerenciarMidias,
  resgatarBody,
  safeExt,
} from "../../backend/src/modules/empresas/shared.js";

describe("empresas/shared — normalizarCodigo", () => {
  it("remove espaços e coloca em maiúsculas", () => {
    assert.equal(normalizarCodigo("  ab12  "), "AB12");
  });

  it("aceita string vazia", () => {
    assert.equal(normalizarCodigo(""), "");
  });
});

describe("empresas/shared — perfilAcessoPorCargo", () => {
  it("administrador mantém administrador", () => {
    assert.equal(perfilAcessoPorCargo("administrador"), "administrador");
  });

  it("demais cargos viram editor", () => {
    assert.equal(perfilAcessoPorCargo("membro"), "editor");
    assert.equal(perfilAcessoPorCargo("editor"), "editor");
  });
});

describe("empresas/shared — cargoApiDeUsuarioEmpresa", () => {
  it("prioriza cargo legado administrador", () => {
    assert.equal(cargoApiDeUsuarioEmpresa({ cargo: "administrador", papel: "membro" }), "administrador");
  });

  it("usa papel admin quando cargo vem vazio", () => {
    assert.equal(cargoApiDeUsuarioEmpresa({ cargo: null, papel: "admin" }), "administrador");
  });

  it("retorna null sem cargo nem papel", () => {
    assert.equal(cargoApiDeUsuarioEmpresa({ cargo: "", papel: null }), null);
  });

  it("usa perfil_acesso do schema usuario_empresa", () => {
    assert.equal(
      cargoApiDeUsuarioEmpresa({ cargo: "", perfil_acesso: "administrador" }),
      "administrador",
    );
    assert.equal(cargoApiDeUsuarioEmpresa({ perfil_acesso: "editor" }), "editor");
  });
});

describe("empresas/shared — podeGerenciarMidias", () => {
  it("admin e editor podem", () => {
    assert.equal(podeGerenciarMidias("administrador"), true);
    assert.equal(podeGerenciarMidias("editor"), true);
  });

  it("membro não pode", () => {
    assert.equal(podeGerenciarMidias("membro"), false);
    assert.equal(podeGerenciarMidias(null), false);
  });
});

describe("empresas/shared — safeExt", () => {
  it("extrai extensão em minúsculas", () => {
    assert.equal(safeExt("Foto.PNG"), "png");
    assert.equal(safeExt("semext"), "bin");
  });
});

describe("empresas/shared — parseJsonIfString", () => {
  it("parseia JSON em string", () => {
    assert.deepEqual(parseJsonIfString('{"a":1}'), { a: 1 });
  });

  it("objeto passa direto", () => {
    const o = { x: 1 };
    assert.strictEqual(parseJsonIfString(o), o);
  });

  it("string inválida retorna valor original", () => {
    assert.equal(parseJsonIfString("{"), "{");
  });
});

describe("empresas/shared — schemas Zod", () => {
  it("resgatarBody exige código com tamanho mínimo", () => {
    assert.equal(resgatarBody.safeParse({ codigo: "ab" }).success, false);
    assert.equal(resgatarBody.safeParse({ codigo: "abcd" }).success, true);
  });

  it("createEmpresaBody exige nome_fantasia", () => {
    const bad = createEmpresaBody.safeParse({});
    assert.equal(bad.success, false);
    const ok = createEmpresaBody.safeParse({
      nome_fantasia: "Minha Loja",
    });
    assert.equal(ok.success, true);
  });
});
