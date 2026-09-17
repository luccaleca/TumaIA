import { getSupabaseAdmin } from "../../supabaseAdmin.js";
import { resolveDashboardRange } from "../plataforma/dateRange.js";
import {
  buildConversasRecentes,
  buildCriacoesRecentes,
  buildDestaques,
  buildEvolucao,
  buildFrequencia,
  dayListFromRange,
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
 * Dashboard TumaCore Empresa — valor e uso do TumaIA na empresa autorizada.
 * Só métricas com fonte no banco atual (sem Instagram / créditos inventados).
 *
 * @param {{ id_empresa: string, period?: string|number, from?: string, to?: string }} opts
 */
export async function loadEmpresaDashboard(opts) {
  const idEmpresa = String(opts?.id_empresa || "").trim();
  if (!idEmpresa) {
    const err = new Error("id_empresa autorizado ausente");
    err.status = 500;
    throw err;
  }

  const db = requireDb();
  const range = resolveDashboardRange(opts);

  const empresaRes = await db
    .from("empresa")
    .select("id_empresa, nome_fantasia, segmento, ativo, data_criacao")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  throwIfError(empresaRes, "Falha ao carregar empresa");

  if (!empresaRes.data || String(empresaRes.data.id_empresa) !== idEmpresa) {
    const err = new Error("Empresa autorizada não encontrada");
    err.status = 404;
    throw err;
  }

  const activity = await loadEmpresaPeriodActivity(
    db,
    idEmpresa,
    range.startIso,
    range.endIsoExclusive,
  );

  const dayList = dayListFromRange(range);
  const evolucao = buildEvolucao(dayList, activity);
  const frequencia = buildFrequencia(dayList, activity);
  const destaques = buildDestaques(activity, { frequencia, evolucao });
  const emp = empresaRes.data;

  return {
    scope: "empresa",
    id_empresa: idEmpresa,
    empresa: {
      id_empresa: idEmpresa,
      nome_fantasia: String(emp.nome_fantasia || "").trim() || "Empresa",
      segmento: String(emp.segmento || "").trim() || "—",
      ativo: emp.ativo !== false,
      data_criacao: emp.data_criacao || null,
      membros: activity.membros.length,
      ultima_atividade: activity.ultimaAtividade,
    },
    range: {
      label: range.label,
      period: range.period,
      from: range.from,
      to: range.to,
      startIso: range.startIso,
      endIsoExclusive: range.endIsoExclusive,
      isRolling24h: range.isRolling24h,
    },
    kpis: {
      conteudos_gerados: activity.conteudosGerados.length,
      conversas: activity.conversas.length,
      mensagens_usuario: activity.msgsUser,
      mensagens_assistente: activity.msgsAssistant,
      midias_acervo: activity.midiasAcervoTotal,
      membros: activity.membros.length,
    },
    frequencia,
    evolucao,
    destaques,
    criacoes_recentes: buildCriacoesRecentes(activity, 8),
    conversas_recentes: buildConversasRecentes(activity, 6),
    metricas_indisponiveis: [
      "aprovados",
      "rejeitados",
      "publicados",
      "pendentes_aprovacao",
      "creditos",
      "playbooks",
    ],
  };
}
