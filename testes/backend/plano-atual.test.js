import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buscarPlanoAtual } from "../../backend/src/modules/empresas/planoAtualService.js";

const USUARIO = "00000000-0000-4000-8000-000000000001";
const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const EMPRESA_B = "22222222-2222-4222-8222-222222222222";
const PLANO_PLUS = "33333333-3333-4333-8333-333333333333";
const PLANO_FREE = "44444444-4444-4444-8444-444444444444";
const AGORA = new Date("2026-10-19T12:00:00Z");

/** Banco falso mínimo: `from().select().eq()...` sobre tabelas em memória. */
function fakeDb(tabelas) {
  return {
    from(nome) {
      let rows = [...(tabelas[nome] || [])];
      const q = {
        select: () => q,
        eq: (col, val) => {
          rows = rows.filter((r) => r[col] === val);
          return q;
        },
        order: (col, { ascending }) => {
          rows.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (ascending ? 1 : -1));
          return q;
        },
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        then: (resolve) => resolve({ data: rows, error: null }),
      };
      return q;
    },
  };
}

const base = {
  usuario_empresa: [
    { id: "m1", id_usuario: USUARIO, id_empresa: EMPRESA_A, ativo: true },
    { id: "m2", id_usuario: USUARIO, id_empresa: EMPRESA_B, ativo: true },
  ],
  usuario: [{ id_usuario: USUARIO, id_empresa_ultima: EMPRESA_A }],
  plano: [
    { id_plano: PLANO_PLUS, nome: "Plus", descricao: "d", valor_mensal: 129.9, limite_posts_mes: 30, limite_contas: 3, limite_usuarios: 3 },
    { id_plano: PLANO_FREE, nome: "Free", descricao: "d", valor_mensal: 79.9, limite_posts_mes: 15, limite_contas: 1, limite_usuarios: 1 },
  ],
};

describe("buscarPlanoAtual", () => {
  it("sem nenhuma assinatura, devolve plano nulo (as tabelas ainda podem estar vazias)", async () => {
    const out = await buscarPlanoAtual(fakeDb({ ...base, assinatura_empresa: [] }), { idUsuario: USUARIO, agora: AGORA });
    assert.equal(out.plano, null);
    assert.equal(out.id_empresa, EMPRESA_A);
  });

  it("usa a empresa pedida quando o usuário é membro e traz o plano dela", async () => {
    const db = fakeDb({
      ...base,
      assinatura_empresa: [
        { id_assinatura: "a1", id_empresa: EMPRESA_B, id_plano: PLANO_PLUS, status: "ativa", data_fim: "2026-12-01T00:00:00Z" },
        { id_assinatura: "a2", id_empresa: EMPRESA_A, id_plano: PLANO_FREE, status: "ativa", data_fim: "2026-12-01T00:00:00Z" },
      ],
    });
    const out = await buscarPlanoAtual(db, { idUsuario: USUARIO, idEmpresaPreferida: EMPRESA_B, agora: AGORA });
    assert.equal(out.id_empresa, EMPRESA_B);
    assert.equal(out.plano.nome, "Plus");
    assert.equal(out.plano.vigente, true);
  });

  it("ignora a empresa pedida se o usuário não for membro e cai na última empresa", async () => {
    const outra = "99999999-9999-4999-8999-999999999999";
    const out = await buscarPlanoAtual(fakeDb({ ...base, assinatura_empresa: [] }), {
      idUsuario: USUARIO,
      idEmpresaPreferida: outra,
      agora: AGORA,
    });
    assert.equal(out.id_empresa, EMPRESA_A);
  });

  it("assinatura vencida aparece como não vigente, em vez de sumir", async () => {
    const db = fakeDb({
      ...base,
      assinatura_empresa: [
        { id_assinatura: "a1", id_empresa: EMPRESA_A, id_plano: PLANO_FREE, status: "ativa", data_fim: "2026-09-01T00:00:00Z" },
      ],
    });
    const out = await buscarPlanoAtual(db, { idUsuario: USUARIO, agora: AGORA });
    assert.equal(out.plano.nome, "Free");
    assert.equal(out.plano.vigente, false);
  });

  it("prefere a assinatura vigente à mais recente que está cancelada", async () => {
    const db = fakeDb({
      ...base,
      assinatura_empresa: [
        { id_assinatura: "a1", id_empresa: EMPRESA_A, id_plano: PLANO_FREE, status: "cancelada", data_fim: "2027-01-01T00:00:00Z" },
        { id_assinatura: "a2", id_empresa: EMPRESA_A, id_plano: PLANO_PLUS, status: "ativa", data_fim: "2026-12-01T00:00:00Z" },
      ],
    });
    const out = await buscarPlanoAtual(db, { idUsuario: USUARIO, agora: AGORA });
    assert.equal(out.plano.nome, "Plus");
  });

  it("usuário sem empresa não tem plano", async () => {
    const out = await buscarPlanoAtual(fakeDb({ usuario_empresa: [], assinatura_empresa: [], plano: [] }), {
      idUsuario: USUARIO,
      agora: AGORA,
    });
    assert.deepEqual(out, { id_empresa: null, plano: null });
  });
});
