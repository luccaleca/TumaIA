import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { montarListaMinhasEmpresas } from "../../backend/src/modules/empresas/empresaListagem.js";

const ID_EMP = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ID_EMP_OFF = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("empresaListagem — oculta empresas desativadas", () => {
  it("não lista vínculo cuja empresa está inativa", () => {
    const membros = [
      { cargo: "administrador", perfil_acesso: "administrador", id_empresa: ID_EMP },
      { cargo: "membro", perfil_acesso: "editor", id_empresa: ID_EMP_OFF },
    ];
    const empresas = [
      { id_empresa: ID_EMP, nome_fantasia: "Ativa", ativo: true },
      { id_empresa: ID_EMP_OFF, nome_fantasia: "Off", ativo: false },
    ];
    const lista = montarListaMinhasEmpresas(membros, empresas);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].empresa?.nome_fantasia, "Ativa");
  });
});
