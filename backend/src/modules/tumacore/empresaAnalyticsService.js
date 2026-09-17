import { getSupabaseAdmin } from "../../supabaseAdmin.js";
import {
  previousDashboardRange,
  resolveDashboardRange,
} from "../plataforma/dateRange.js";
import {
  buildDestaques,
  buildEvolucao,
  buildFrequencia,
  dayListFromRange,
  deltaPct,
  loadEmpresaPeriodActivity,
  throwIfError,
} from "./empresaMetricsShared.js";

function requireDb() {
  const db = getSupabaseAdmin();
  if (!db) {
    const err = new Error("Supabase não configurado no servidor");
    err.status = 503;
    throw err;
  }
  return db;
}

/**
 * Analytics TumaCore Empresa — visão aprofundada do uso do TumaIA.
 * Sem métricas de Instagram nem créditos sem ledger no banco.
 *
 * @param {{ id_empresa: string, period?: string|number, from?: string, to?: string }} opts
 */
export async function loadEmpresaAnalytics(opts) {
  const idEmpresa = String(opts?.id_empresa || "").trim();
  if (!idEmpresa) {
    const err = new Error("id_empresa autorizado ausente");
    err.status = 500;
    throw err;
  }

  const db = requireDb();
  const range = resolveDashboardRange(opts);
  const prev = previousDashboardRange(range);

  const empresaRes = await db
    .from("empresa")
    .select("id_empresa, nome_fantasia, ativo")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  throwIfError(empresaRes, "Falha ao carregar empresa");
  if (!empresaRes.data || String(empresaRes.data.id_empresa) !== idEmpresa) {
    const err = new Error("Empresa autorizada não encontrada");
    err.status = 404;
    throw err;
  }

  const [now, before] = await Promise.all([
    loadEmpresaPeriodActivity(db, idEmpresa, range.startIso, range.endIsoExclusive),
    loadEmpresaPeriodActivity(db, idEmpresa, prev.startIso, prev.endIsoExclusive),
  ]);

  const dayList = dayListFromRange(range);
  const evolucao = buildEvolucao(dayList, now);
  const frequencia = buildFrequencia(dayList, now);
  const destaques = buildDestaques(now, { frequencia, evolucao });
  const emp = empresaRes.data;

  const producao = {
    conteudos_gerados: now.conteudosGerados.length,
    midias_acervo_periodo: now.midiasAcervoPeriodo.length,
    midias_acervo_total: now.midiasAcervoTotal,
    midias_identidade_periodo: now.midiasIdentidadePeriodo.length,
    frequencia,
    por_origem: now.midiasPorOrigem,
    tendencia: evolucao.map((d) => ({
      day: d.day,
      conteudos_gerados: d.conteudos_gerados,
      midias: d.midias,
    })),
    delta: {
      conteudos_gerados: deltaPct(
        now.conteudosGerados.length,
        before.conteudosGerados.length,
      ),
      midias_acervo_periodo: deltaPct(
        now.midiasAcervoPeriodo.length,
        before.midiasAcervoPeriodo.length,
      ),
    },
  };

  const uso = {
    conversas: now.conversas.length,
    mensagens_usuario: now.msgsUser,
    mensagens_assistente: now.msgsAssistant,
    tipos_solicitacao: now.tiposSolicitacao,
    heatmap: now.heatmap,
    tendencia: evolucao.map((d) => ({
      day: d.day,
      mensagens_usuario: d.mensagens_usuario,
      mensagens_assistente: d.mensagens_assistente,
      conversas: d.conversas,
    })),
    delta: {
      conversas: deltaPct(now.conversas.length, before.conversas.length),
      mensagens_usuario: deltaPct(now.msgsUser, before.msgsUser),
      mensagens_assistente: deltaPct(now.msgsAssistant, before.msgsAssistant),
    },
  };

  const empresa = {
    membros: now.membros.length,
    membros_ativos_periodo: now.membrosAtivos.filter(
      (m) => m.conversas > 0 || m.conteudos_gerados > 0 || m.mensagens > 0,
    ).length,
    midias_cadastradas: now.midiasAcervoTotal,
    midias_total: now.midiasTotal,
    membros_mais_ativos: now.membrosAtivos.slice(0, 10),
  };

  return {
    scope: "empresa",
    id_empresa: idEmpresa,
    empresa: {
      id_empresa: idEmpresa,
      nome_fantasia: String(emp.nome_fantasia || "").trim() || "Empresa",
      ativo: emp.ativo !== false,
    },
    range: {
      label: range.label,
      period: range.period,
      from: range.from,
      to: range.to,
    },
    previous: {
      label: prev.label,
      conteudos_gerados: before.conteudosGerados.length,
      conversas: before.conversas.length,
      mensagens_usuario: before.msgsUser,
      mensagens_assistente: before.msgsAssistant,
      midias_acervo_periodo: before.midiasAcervoPeriodo.length,
    },
    producao,
    uso,
    empresa_detalhe: empresa,
    destaques,
    metricas_indisponiveis: [
      "aprovados",
      "rejeitados",
      "publicados",
      "pendentes_aprovacao",
      "revisoes",
      "creditos",
      "playbooks_modelos",
    ],
  };
}
