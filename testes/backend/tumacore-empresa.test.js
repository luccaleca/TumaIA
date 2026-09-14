import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickIdEmpresaAutorizada,
  resolveTumaCoreEmpresaAutorizada,
} from "../../backend/src/modules/tumacore/empresaAuth.js";
import { requireTumaCoreEmpresa } from "../../backend/src/middleware/requireTumaCoreEmpresa.js";
import { requireDonoPlataforma } from "../../backend/src/middleware/requireDonoPlataforma.js";
import { createApp } from "../../backend/src/app.js";

const EMP_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EMP_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER_A = "11111111-1111-1111-1111-111111111111";

function createAuthMockDb({ membros = [], empresas = [] } = {}) {
  return {
    from(table) {
      const state = { filters: {}, inIds: null };
      const chain = {
        select() {
          return chain;
        },
        eq(col, val) {
          state.filters[col] = val;
          return chain;
        },
        in(col, vals) {
          state.inIds = { col, vals: (vals || []).map(String) };
          return chain;
        },
        then(resolve) {
          if (table === "usuario_empresa") {
            let rows = [...membros];
            if (state.filters.id_usuario) {
              rows = rows.filter(
                (r) => String(r.id_usuario) === String(state.filters.id_usuario),
              );
            }
            if (state.filters.ativo !== undefined) {
              rows = rows.filter((r) => r.ativo === state.filters.ativo);
            }
            resolve({ data: rows, error: null });
            return;
          }
          if (table === "empresa") {
            let rows = [...empresas];
            if (state.inIds?.col === "id_empresa") {
              const set = new Set(state.inIds.vals);
              rows = rows.filter((r) => set.has(String(r.id_empresa)));
            }
            resolve({ data: rows, error: null });
            return;
          }
          resolve({ data: [], error: null });
        },
      };
      return chain;
    },
  };
}

describe("tumacore empresa — pickIdEmpresaAutorizada", () => {
  it("Empresa A e B escolhem a própria quando ultima corresponde", () => {
    const a = pickIdEmpresaAutorizada(
      [
        { id_empresa: EMP_A, nome_fantasia: "A" },
        { id_empresa: EMP_B, nome_fantasia: "B" },
      ],
      EMP_A,
    );
    const b = pickIdEmpresaAutorizada(
      [
        { id_empresa: EMP_A, nome_fantasia: "A" },
        { id_empresa: EMP_B, nome_fantasia: "B" },
      ],
      EMP_B,
    );
    assert.equal(a.id_empresa, EMP_A);
    assert.equal(b.id_empresa, EMP_B);
  });

  it("ignora id_empresa_ultima de outra empresa (não amplia)", () => {
    const onlyA = pickIdEmpresaAutorizada(
      [{ id_empresa: EMP_A, nome_fantasia: "A" }],
      EMP_B,
    );
    assert.equal(onlyA.id_empresa, EMP_A);
  });
});

describe("tumacore empresa — resolveTumaCoreEmpresaAutorizada", () => {
  it("permite administrador da Empresa A", async () => {
    const db = createAuthMockDb({
      membros: [
        {
          id_usuario: USER_A,
          id_empresa: EMP_A,
          cargo: "administrador",
          ativo: true,
        },
      ],
      empresas: [{ id_empresa: EMP_A, nome_fantasia: "Empresa A", ativo: true }],
    });
    const out = await resolveTumaCoreEmpresaAutorizada(db, {
      id_usuario: USER_A,
      id_empresa_ultima: EMP_A,
    });
    assert.equal(out.ok, true);
    assert.equal(out.id_empresa, EMP_A);
  });

  it("permite administrador da Empresa B", async () => {
    const db = createAuthMockDb({
      membros: [
        {
          id_usuario: USER_A,
          id_empresa: EMP_B,
          cargo: "administrador",
          ativo: true,
        },
      ],
      empresas: [{ id_empresa: EMP_B, nome_fantasia: "Empresa B", ativo: true }],
    });
    const out = await resolveTumaCoreEmpresaAutorizada(db, {
      id_usuario: USER_A,
      id_empresa_ultima: EMP_B,
    });
    assert.equal(out.ok, true);
    assert.equal(out.id_empresa, EMP_B);
  });

  it("nega vínculo ativo sem cargo administrador", async () => {
    const db = createAuthMockDb({
      membros: [
        {
          id_usuario: USER_A,
          id_empresa: EMP_A,
          cargo: "editor",
          ativo: true,
        },
      ],
      empresas: [{ id_empresa: EMP_A, nome_fantasia: "A", ativo: true }],
    });
    const out = await resolveTumaCoreEmpresaAutorizada(db, {
      id_usuario: USER_A,
      id_empresa_ultima: EMP_A,
    });
    assert.equal(out.ok, false);
    assert.equal(out.status, 403);
  });

  it("nega usuário sem vínculo", async () => {
    const db = createAuthMockDb({ membros: [], empresas: [] });
    const out = await resolveTumaCoreEmpresaAutorizada(db, {
      id_usuario: USER_A,
    });
    assert.equal(out.ok, false);
    assert.equal(out.status, 403);
  });

  it("manipular id_empresa_ultima para Empresa B não libera se só é admin de A", async () => {
    const db = createAuthMockDb({
      membros: [
        {
          id_usuario: USER_A,
          id_empresa: EMP_A,
          cargo: "administrador",
          ativo: true,
        },
      ],
      empresas: [
        { id_empresa: EMP_A, nome_fantasia: "A", ativo: true },
        { id_empresa: EMP_B, nome_fantasia: "B", ativo: true },
      ],
    });
    const out = await resolveTumaCoreEmpresaAutorizada(db, {
      id_usuario: USER_A,
      id_empresa_ultima: EMP_B,
    });
    assert.equal(out.ok, true);
    assert.equal(out.id_empresa, EMP_A);
  });
});

describe("tumacore empresa — rotas e middleware", () => {
  it("createApp monta app com /tumacore/empresa", () => {
    const app = createApp();
    assert.ok(app);
    assert.equal(typeof app.handle, "function");
  });

  it("requireTumaCoreEmpresa bloqueia sem vínculo admin (mock resolve via usuario vazio)", async () => {
    /** Força falha sem bater no Supabase real: usuario sem id. */
    const req = { usuario: {} };
    let status = 0;
    let body = null;
    const res = {
      status(code) {
        status = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    };
    let nextCalled = false;
    await requireTumaCoreEmpresa(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(status, 403);
    assert.match(String(body?.error || ""), /empresa|perfil/i);
  });

  it("cliente comum continua bloqueado em /plataforma (requireDonoPlataforma)", () => {
    const req = { usuario: { email: "admin-empresa@cliente.com", cargo: "administrador" } };
    let status = 0;
    const res = {
      status(code) {
        status = code;
        return this;
      },
      json() {
        return this;
      },
    };
    let nextCalled = false;
    requireDonoPlataforma(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(status, 403);
  });
});
