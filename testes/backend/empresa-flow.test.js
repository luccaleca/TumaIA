import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { criarEmpresaParaUsuario } from "../../backend/src/modules/empresas/empresaCriacao.js";
import {
  executarCriacaoConviteAdmin,
  executarResgateConvite,
} from "../../backend/src/modules/empresas/empresaConvites.js";
import {
  montarListaMembrosComUsuarios,
  montarListaMinhasEmpresas,
} from "../../backend/src/modules/empresas/empresaListagem.js";

const ID_EMP = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ID_USER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ID_USER_2 = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("empresa — montarListaMinhasEmpresas (dados para a página /minhas)", () => {
  it("junta cada vínculo usuario_empresa com o objeto empresa", () => {
    const membros = [
      {
        cargo: "administrador",
        perfil_acesso: "administrador",
        responsavel_operacional: true,
        receber_alertas: true,
        id_empresa: ID_EMP,
      },
    ];
    const empresasRows = [
      {
        id_empresa: ID_EMP,
        nome_fantasia: "Loja Teste",
        razao_social: "LTDA",
      },
    ];
    const lista = montarListaMinhasEmpresas(membros, empresasRows);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].papel, "administrador");
    assert.equal(lista[0].empresa?.nome_fantasia, "Loja Teste");
    assert.equal(lista[0].responsavel_operacional, true);
  });

  it("empresa null quando o id não está no mapa", () => {
    const lista = montarListaMinhasEmpresas(
      [{ cargo: "membro", perfil_acesso: "editor", responsavel_operacional: false, receber_alertas: false, id_empresa: ID_EMP }],
      [],
    );
    assert.equal(lista[0].empresa, null);
  });
});

describe("empresa — montarListaMembrosComUsuarios (lista na página de membros)", () => {
  it("preenche nome e e-mail a partir de public.usuario", () => {
    const membros = [
      {
        id_usuario: ID_USER,
        cargo: "administrador",
        perfil_acesso: "administrador",
        responsavel_operacional: true,
        receber_alertas: true,
        ativo: true,
      },
      {
        id_usuario: ID_USER_2,
        cargo: "membro",
        perfil_acesso: "editor",
        responsavel_operacional: false,
        receber_alertas: true,
        ativo: true,
      },
    ];
    const usuariosRows = [
      { id_usuario: ID_USER, nome: "Alice", email: "alice@ex.com" },
      { id_usuario: ID_USER_2, nome: "Bob", email: "bob@ex.com" },
    ];
    const lista = montarListaMembrosComUsuarios(membros, usuariosRows);
    assert.equal(lista.length, 2);
    assert.equal(lista[0].nome, "Alice");
    assert.equal(lista[0].email, "alice@ex.com");
    assert.equal(lista[1].cargo, "membro");
    assert.equal(lista[1].nome, "Bob");
  });
});

describe("empresa — criarEmpresaParaUsuario (cadastro salvo + vínculo)", () => {
  it("insere empresa e vincula criador como administrador", async () => {
    const insertedEmpresa = {
      id_empresa: ID_EMP,
      nome_fantasia: "Nova Marca",
      razao_social: null,
    };
    let deleteCalled = false;
    const supabase = {
      from(table) {
        if (table === "empresa") {
          return {
            insert(row) {
              assert.equal(row.nome_fantasia, "Nova Marca");
              return {
                select() {
                  return {
                    single: async () => ({ data: { ...insertedEmpresa, ...row }, error: null }),
                  };
                },
              };
            },
            delete() {
              return {
                eq() {
                  deleteCalled = true;
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        }
        if (table === "usuario_empresa") {
          return {
            insert(payload) {
              assert.equal(payload.id_empresa, ID_EMP);
              assert.equal(payload.id_usuario, ID_USER);
              assert.equal(payload.cargo, "administrador");
              return Promise.resolve({ error: null });
            },
          };
        }
        throw new Error(`from inesperado: ${table}`);
      },
    };

    const out = await criarEmpresaParaUsuario(supabase, ID_USER, {
      nome_fantasia: "Nova Marca",
    });
    assert.equal(out.ok, true);
    assert.equal(out.empresa.nome_fantasia, "Nova Marca");
    assert.equal(deleteCalled, false);
  });

  it("rejeita body inválido (Zod) sem tocar no banco", async () => {
    const supabase = {
      from() {
        throw new Error("não deve chamar Supabase");
      },
    };
    const out = await criarEmpresaParaUsuario(supabase, ID_USER, { nome_fantasia: "" });
    assert.equal(out.ok, false);
    assert.equal(out.status, 400);
  });
});

describe("empresa — executarResgateConvite", () => {
  it("rejeita código muito curto após normalizar", async () => {
    const supabase = { from: () => ({}) };
    const out = await executarResgateConvite(supabase, ID_USER, { codigo: " ab " });
    assert.equal(out.ok, false);
    assert.equal(out.status, 400);
  });

  it("retorna 410 quando a data de expiração já passou", async () => {
    const supabase = {
      from(table) {
        if (table === "empresa_convite") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({
                          data: {
                            id_convite: "11111111-1111-1111-1111-111111111111",
                            id_empresa: ID_EMP,
                            codigo: "ABC123",
                            ativo: true,
                            usos: 0,
                            max_usos: 1,
                            data_expiracao: "2000-01-01T00:00:00.000Z",
                            cargo: "membro",
                            perfil_acesso: "editor",
                            responsavel_operacional: false,
                            receber_alertas: true,
                          },
                          error: null,
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`from inesperado: ${table}`);
      },
    };
    const out = await executarResgateConvite(supabase, ID_USER, { codigo: "ABC123" });
    assert.equal(out.ok, false);
    assert.equal(out.status, 410);
    assert.match(String(out.error), /expirou/);
  });

  it("fluxo feliz: novo membro, incrementa usos e retorna 201", async () => {
    const conv = {
      id_convite: "22222222-2222-2222-2222-222222222222",
      id_empresa: ID_EMP,
      codigo: "JOINME",
      ativo: true,
      usos: 0,
      max_usos: 1,
      data_expiracao: "2099-12-31T23:59:59.000Z",
      cargo: "editor",
      perfil_acesso: "editor",
      responsavel_operacional: false,
      receber_alertas: true,
    };
    const empresa = { id_empresa: ID_EMP, nome_fantasia: "Acme" };
    let insertUePayload = null;
    let updateConviteFilter = null;

    const supabase = {
      from(table) {
        if (table === "empresa_convite") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({ data: conv, error: null }),
                      };
                    },
                  };
                },
              };
            },
            update(patch) {
              updateConviteFilter = patch;
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        select() {
                          return {
                            maybeSingle: async () => ({
                              data: { id_convite: conv.id_convite },
                              error: null,
                            }),
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (table === "empresa") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: empresa, error: null }),
                  };
                },
              };
            },
          };
        }
        if (table === "usuario_empresa") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({ data: null, error: null }),
                      };
                    },
                  };
                },
              };
            },
            insert(payload) {
              insertUePayload = payload;
              return Promise.resolve({ error: null });
            },
            delete() {
              return {
                eq() {
                  return { eq: async () => ({ error: null }) };
                },
              };
            },
          };
        }
        throw new Error(`from inesperado: ${table}`);
      },
    };

    const out = await executarResgateConvite(supabase, ID_USER, { codigo: "joinme" });
    assert.equal(out.ok, true);
    assert.equal(out.status, 201);
    assert.equal(out.body.empresa.nome_fantasia, "Acme");
    assert.equal(insertUePayload.id_usuario, ID_USER);
    assert.equal(insertUePayload.id_empresa, ID_EMP);
    assert.equal(updateConviteFilter.usos, 1);
  });

  it("membro já ativo retorna 200 com ja_membro", async () => {
    const conv = {
      id_convite: "33333333-3333-3333-3333-333333333333",
      id_empresa: ID_EMP,
      codigo: "ALREADY",
      ativo: true,
      usos: 0,
      max_usos: 5,
      data_expiracao: null,
      cargo: "membro",
      perfil_acesso: "editor",
      responsavel_operacional: false,
      receber_alertas: true,
    };
    const empresa = { id_empresa: ID_EMP, nome_fantasia: "X" };
    const supabase = {
      from(table) {
        if (table === "empresa_convite") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({ data: conv, error: null }),
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (table === "empresa") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: empresa, error: null }),
                  };
                },
              };
            },
          };
        }
        if (table === "usuario_empresa") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({
                          data: {
                            id: "ue-1",
                            cargo: "administrador",
                            ativo: true,
                          },
                          error: null,
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`from inesperado: ${table}`);
      },
    };

    const out = await executarResgateConvite(supabase, ID_USER, { codigo: "already" });
    assert.equal(out.ok, true);
    assert.equal(out.status, 200);
    assert.equal(out.body.ja_membro, true);
  });
});

describe("empresa — executarCriacaoConviteAdmin", () => {
  it("403 quando quem chama não é administrador", async () => {
    const supabase = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      eq() {
                        return {
                          maybeSingle: async () => ({
                            data: { cargo: "membro", ativo: true },
                            error: null,
                          }),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    };
    const out = await executarCriacaoConviteAdmin(supabase, ID_EMP, ID_USER, {}, {
      now: new Date("2026-01-01T12:00:00.000Z"),
      gerarCodigo: () => "CODIGOFIXO12",
    });
    assert.equal(out.ok, false);
    assert.equal(out.status, 403);
  });

  it("201 e convite quando é administrador", async () => {
    const fixedNow = new Date("2026-06-15T12:00:00.000Z");
    const supabase = {
      from(table) {
        if (table === "usuario_empresa") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        eq() {
                          return {
                            maybeSingle: async () => ({
                              data: { cargo: "administrador", ativo: true },
                              error: null,
                            }),
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (table === "empresa_convite") {
          return {
            insert(row) {
              assert.equal(row.codigo, "CODIGOFIXO12");
              assert.equal(row.id_empresa, ID_EMP);
              return {
                select() {
                  return {
                    single: async () => ({
                      data: {
                        id_convite: "44444444-4444-4444-4444-444444444444",
                        codigo: row.codigo,
                        data_expiracao: row.data_expiracao,
                        max_usos: 1,
                        data_criacao: "2026-06-15T12:00:00.000Z",
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }
        throw new Error(`from inesperado: ${table}`);
      },
    };

    const out = await executarCriacaoConviteAdmin(supabase, ID_EMP, ID_USER, {}, {
      now: fixedNow,
      gerarCodigo: () => "CODIGOFIXO12",
    });
    assert.equal(out.ok, true);
    assert.equal(out.status, 201);
    assert.equal(out.body.convite.codigo, "CODIGOFIXO12");
    assert.ok(out.body.mensagem);
  });
});
