import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadUsuarioParaMe } from "../../backend/src/modules/auth/usuarioMeService.js";

const AUTH_ID = "11111111-1111-1111-1111-111111111111";

/** Mock mínimo do encadeamento Supabase usado por `loadUsuarioParaMe`. */
function createMockDb(opts) {
  let selectEqCount = 0;
  const builder = {
    select() {
      return {
        eq() {
          return {
            maybeSingle: async () => {
              selectEqCount += 1;
              if (selectEqCount === 1) return opts.firstSelectEq;
              if (selectEqCount === 2) return opts.secondSelectEq;
              throw new Error(`select.eq.maybeSingle inesperado (#${selectEqCount})`);
            },
          };
        },
      };
    },
    insert() {
      return {
        select() {
          return {
            maybeSingle: async () => opts.insertMaybeSingle(),
          };
        },
      };
    },
  };

  return {
    from() {
      return builder;
    },
    auth: {
      admin: {
        getUserById: async () => opts.getUserById(),
      },
    },
  };
}

function assertUsuarioRespostaCoerente(usuario, authUserId) {
  assert.ok(usuario && typeof usuario === "object");
  assert.equal(usuario.auth_user_id, authUserId);
  assert.ok(typeof usuario.nome === "string" && usuario.nome.length > 0);
  assert.ok("email" in usuario);
  assert.ok("telefone" in usuario);
  assert.equal(usuario.ativo, true);
  assert.ok(typeof usuario.id_usuario === "string");
}

describe("auth-conta — GET /auth/me (loadUsuarioParaMe)", () => {
  it("devolve a linha do usuario quando já existe", async () => {
    const row = {
      id_usuario: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      auth_user_id: AUTH_ID,
      nome: "Maria Souza",
      email: "maria@exemplo.com",
      telefone: "11999998888",
      ativo: true,
      data_criacao: "2025-01-10T12:00:00.000Z",
    };
    const db = createMockDb({
      firstSelectEq: { data: row, error: null },
      secondSelectEq: { data: null, error: { message: "não deveria haver 2º select" } },
      insertMaybeSingle: async () => {
        throw new Error("insert não deveria ser chamado");
      },
      getUserById: async () => {
        throw new Error("getUserById não deveria ser chamado");
      },
    });

    const out = await loadUsuarioParaMe(db, AUTH_ID);
    assert.equal(out.ok, true);
    assertUsuarioRespostaCoerente(out.usuario, AUTH_ID);
    assert.equal(out.usuario.nome, "Maria Souza");
    assert.equal(out.usuario.email, "maria@exemplo.com");
    assert.equal(out.usuario.telefone, "11999998888");
    assert.equal(out.usuario.data_criacao, row.data_criacao);
  });

  it("retorna 404 quando não há linha e o Auth não acha o usuário", async () => {
    const db = createMockDb({
      firstSelectEq: { data: null, error: null },
      secondSelectEq: { data: null, error: null },
      insertMaybeSingle: async () => ({ data: {}, error: null }),
      getUserById: async () => ({ data: null, error: { message: "not found" } }),
    });

    const out = await loadUsuarioParaMe(db, AUTH_ID);
    assert.equal(out.ok, false);
    assert.equal(out.status, 404);
    assert.match(out.error, /Perfil não encontrado/);
  });

  it("cria fallback a partir do Auth e devolve o registro criado", async () => {
    const created = {
      id_usuario: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      auth_user_id: AUTH_ID,
      nome: "João",
      email: "joao@exemplo.com",
      telefone: null,
      ativo: true,
      data_criacao: "2025-02-01T00:00:00.000Z",
    };

    const db = createMockDb({
      firstSelectEq: { data: null, error: null },
      secondSelectEq: { data: null, error: null },
      insertMaybeSingle: async () => ({ data: created, error: null }),
      getUserById: async () => ({
        data: {
          user: {
            email: "joao@exemplo.com",
            user_metadata: { nome: "João" },
          },
        },
        error: null,
      }),
    });

    const out = await loadUsuarioParaMe(db, AUTH_ID);
    assert.equal(out.ok, true);
    assertUsuarioRespostaCoerente(out.usuario, AUTH_ID);
    assert.equal(out.usuario.nome, "João");
    assert.equal(out.usuario.email, "joao@exemplo.com");
    assert.equal(out.usuario.telefone, null);
  });

  it("usa nome derivado do e-mail quando metadata.nome vem vazio", async () => {
    const created = {
      id_usuario: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      auth_user_id: AUTH_ID,
      nome: "ana.silva",
      email: "ana.silva@empresa.org",
      telefone: null,
      ativo: true,
      data_criacao: "2025-03-01T00:00:00.000Z",
    };

    const db = createMockDb({
      firstSelectEq: { data: null, error: null },
      secondSelectEq: { data: null, error: null },
      insertMaybeSingle: async () => ({ data: created, error: null }),
      getUserById: async () => ({
        data: {
          user: {
            email: "ana.silva@empresa.org",
            user_metadata: {},
          },
        },
        error: null,
      }),
    });

    const out = await loadUsuarioParaMe(db, AUTH_ID);
    assert.equal(out.ok, true);
    assert.equal(out.usuario.nome, "ana.silva");
  });

  it("em conflito de insert, refaz o select e devolve a linha existente", async () => {
    const retried = {
      id_usuario: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      auth_user_id: AUTH_ID,
      nome: "Duplicado",
      email: "dup@exemplo.com",
      telefone: null,
      ativo: true,
      data_criacao: "2025-04-01T00:00:00.000Z",
    };

    const db = createMockDb({
      firstSelectEq: { data: null, error: null },
      secondSelectEq: { data: retried, error: null },
      insertMaybeSingle: async () => ({
        data: null,
        error: { message: 'duplicate key value violates unique constraint "usuarios_pkey"' },
      }),
      getUserById: async () => ({
        data: {
          user: {
            email: "dup@exemplo.com",
            user_metadata: { nome: "Duplicado" },
          },
        },
        error: null,
      }),
    });

    const out = await loadUsuarioParaMe(db, AUTH_ID);
    assert.equal(out.ok, true);
    assert.equal(out.usuario.nome, "Duplicado");
    assert.equal(out.usuario.id_usuario, retried.id_usuario);
  });

  it("propaga erro 500 quando o primeiro select falha", async () => {
    const db = createMockDb({
      firstSelectEq: { data: null, error: { message: "timeout" } },
      secondSelectEq: { data: null, error: null },
      insertMaybeSingle: async () => ({ data: null, error: null }),
      getUserById: async () => ({ data: null, error: null }),
    });

    const out = await loadUsuarioParaMe(db, AUTH_ID);
    assert.equal(out.ok, false);
    assert.equal(out.status, 500);
    assert.equal(out.error, "timeout");
  });
});
