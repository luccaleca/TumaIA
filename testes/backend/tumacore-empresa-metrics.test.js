import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDestaques,
  buildEvolucao,
  buildFrequencia,
  dayListFromRange,
  deltaPct,
} from "../../backend/src/modules/tumacore/empresaMetricsShared.js";
import { loadEmpresaDashboard } from "../../backend/src/modules/tumacore/empresaDashboardService.js";
import { loadEmpresaAnalytics } from "../../backend/src/modules/tumacore/empresaAnalyticsService.js";

function emptyActivity(overrides = {}) {
  return {
    midias: [],
    conversas: [],
    msgsRows: [],
    membros: [],
    usuariosById: new Map(),
    conteudosGerados: [],
    midiasAcervoPeriodo: [],
    midiasIdentidadePeriodo: [],
    midiasTotal: 0,
    midiasAcervoTotal: 0,
    msgsUser: 0,
    msgsAssistant: 0,
    msgsAssistantComImagem: 0,
    msgsAssistantTexto: 0,
    msgsUserPorDia: new Map(),
    msgsAssistantPorDia: new Map(),
    conteudosPorDia: new Map(),
    midiasPorDia: new Map(),
    conversasPorDia: new Map(),
    heatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
    membrosAtivos: [],
    tiposSolicitacao: [],
    midiasPorOrigem: [],
    ultimaAtividade: null,
    ...overrides,
  };
}

describe("tumacore empresa — métricas compartilhadas", () => {
  it("deltaPct trata base zero", () => {
    assert.equal(deltaPct(0, 0), 0);
    assert.equal(deltaPct(5, 0), 100);
    assert.equal(deltaPct(15, 10), 50);
  });

  it("dayListFromRange gera dias inclusivos", () => {
    const days = dayListFromRange({
      from: "2026-09-10",
      to: "2026-09-12",
      isRolling24h: false,
    });
    assert.deepEqual(days, ["2026-09-10", "2026-09-11", "2026-09-12"]);
  });

  it("buildFrequencia conta dias com uso", () => {
    const activity = emptyActivity({
      conteudosPorDia: new Map([["2026-09-10", 2]]),
      msgsUserPorDia: new Map([["2026-09-12", 1]]),
      conversasPorDia: new Map(),
    });
    const freq = buildFrequencia(["2026-09-10", "2026-09-11", "2026-09-12"], activity);
    assert.equal(freq.dias_com_uso, 2);
    assert.equal(freq.dias_no_periodo, 3);
    assert.equal(freq.percentual, 66.7);
  });

  it("buildEvolucao e destaques usam só dados reais", () => {
    const activity = emptyActivity({
      conteudosPorDia: new Map([["2026-09-10", 3]]),
      msgsUserPorDia: new Map([["2026-09-10", 4]]),
      conversasPorDia: new Map([["2026-09-10", 1]]),
      membrosAtivos: [
        {
          id_usuario: "u1",
          nome: "Ana",
          email: "ana@ex.com",
          conversas: 2,
          conteudos_gerados: 3,
          mensagens: 5,
        },
      ],
      tiposSolicitacao: [{ tipo: "arte_com_imagem", label: "Respostas com arte", total: 3 }],
      midiasPorOrigem: [
        { origem: "chat_preview", label: "Geradas no chat", total: 3 },
      ],
    });
    const evolucao = buildEvolucao(["2026-09-10", "2026-09-11"], activity);
    assert.equal(evolucao[0].conteudos_gerados, 3);
    assert.equal(evolucao[1].conteudos_gerados, 0);

    const freq = buildFrequencia(["2026-09-10", "2026-09-11"], activity);
    const destaques = buildDestaques(activity, { frequencia: freq, evolucao });
    assert.ok(destaques.some((d) => d.id === "membro_mais_ativo" && d.valor === "Ana"));
    assert.ok(destaques.some((d) => d.id === "tipo_mais_usado"));
    assert.ok(!destaques.some((d) => /instagram|curtida|crédito/i.test(d.titulo)));
  });
});

describe("tumacore empresa — services", () => {
  it("dashboard e analytics exigem id_empresa autorizado", async () => {
    await assert.rejects(() => loadEmpresaDashboard({}), /id_empresa/);
    await assert.rejects(() => loadEmpresaAnalytics({ period: 7 }), /id_empresa/);
  });
});
