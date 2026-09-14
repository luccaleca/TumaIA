import { getSupabaseAdmin } from "../../supabaseAdmin.js";
import {
  dayKeyFromIso,
  resolveDashboardRange,
  shiftYmd,
  ymdFromInstant,
} from "../plataforma/dateRange.js";

function requireDb() {
  const db = getSupabaseAdmin();
  if (!db) {
    const err = new Error("Supabase não configurado no servidor");
    err.status = 503;
    throw err;
  }
  return db;
}

function throwIfError(res, fallback) {
  if (res?.error) {
    const err = new Error(res.error.message || fallback);
    err.status = 500;
    throw err;
  }
}

/**
 * Dashboard TumaCore Empresa — apenas a empresa autorizada pelo backend.
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
  const { startIso, endIsoExclusive } = range;

  const [
    empresaRes,
    membrosRes,
    midiasTotalRes,
    midiasPeriodoRes,
    conversasRes,
  ] = await Promise.all([
    db
      .from("empresa")
      .select("id_empresa, nome_fantasia, segmento, ativo, data_criacao")
      .eq("id_empresa", idEmpresa)
      .maybeSingle(),
    db
      .from("usuario_empresa")
      .select("id_usuario", { count: "exact", head: true })
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true),
    db
      .from("midia")
      .select("id_midia", { count: "exact", head: true })
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true),
    db
      .from("midia")
      .select("data_criacao")
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true)
      .gte("data_criacao", startIso)
      .lt("data_criacao", endIsoExclusive)
      .limit(5000),
    db
      .from("chat_conversa")
      .select("id_conversa, data_atualizacao")
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true)
      .gte("data_atualizacao", startIso)
      .lt("data_atualizacao", endIsoExclusive)
      .limit(5000),
  ]);

  for (const r of [empresaRes, membrosRes, midiasTotalRes, midiasPeriodoRes, conversasRes]) {
    throwIfError(r, "Falha ao agregar dashboard da empresa");
  }

  if (!empresaRes.data || String(empresaRes.data.id_empresa) !== idEmpresa) {
    const err = new Error("Empresa autorizada não encontrada");
    err.status = 404;
    throw err;
  }

  const conversas = Array.isArray(conversasRes.data) ? conversasRes.data : [];
  const conversaIds = conversas.map((c) => String(c.id_conversa)).filter(Boolean);

  let msgsRows = [];
  if (conversaIds.length) {
    const mensagensRes = await db
      .from("chat_mensagem")
      .select("data_criacao, papel, id_conversa")
      .in("id_conversa", conversaIds)
      .in("papel", ["user", "assistant"])
      .gte("data_criacao", startIso)
      .lt("data_criacao", endIsoExclusive)
      .limit(8000);
    throwIfError(mensagensRes, "Falha ao agregar mensagens da empresa");
    msgsRows = Array.isArray(mensagensRes.data) ? mensagensRes.data : [];
  }

  const midiasPeriodo = Array.isArray(midiasPeriodoRes.data) ? midiasPeriodoRes.data : [];

  const midiasPorDia = new Map();
  let ultimaAtividade = null;
  for (const m of midiasPeriodo) {
    const day = dayKeyFromIso(m.data_criacao);
    if (day) midiasPorDia.set(day, (midiasPorDia.get(day) || 0) + 1);
    if (m.data_criacao && (!ultimaAtividade || String(m.data_criacao) > String(ultimaAtividade))) {
      ultimaAtividade = m.data_criacao;
    }
  }

  const conversasPorDia = new Map();
  for (const c of conversas) {
    const day = dayKeyFromIso(c.data_atualizacao);
    if (day) conversasPorDia.set(day, (conversasPorDia.get(day) || 0) + 1);
    if (c.data_atualizacao && (!ultimaAtividade || String(c.data_atualizacao) > String(ultimaAtividade))) {
      ultimaAtividade = c.data_atualizacao;
    }
  }

  const msgsUserPorDia = new Map();
  const msgsAssistantPorDia = new Map();
  let msgsUser = 0;
  let msgsAssistant = 0;
  for (const m of msgsRows) {
    const day = dayKeyFromIso(m.data_criacao);
    if (m.papel === "user") {
      msgsUser += 1;
      if (day) msgsUserPorDia.set(day, (msgsUserPorDia.get(day) || 0) + 1);
    } else if (m.papel === "assistant") {
      msgsAssistant += 1;
      if (day) msgsAssistantPorDia.set(day, (msgsAssistantPorDia.get(day) || 0) + 1);
    }
  }

  const days = [];
  if (range.isRolling24h) {
    days.push(ymdFromInstant(new Date(range.startIso)), ymdFromInstant(new Date()));
  } else {
    let cur = range.from;
    while (cur <= range.to) {
      days.push(cur);
      cur = shiftYmd(cur, 1);
    }
  }
  const dayList = [...new Set(days)];

  const evolucao = dayList.map((day) => ({
    day,
    mensagens_usuario: msgsUserPorDia.get(day) || 0,
    mensagens_assistente: msgsAssistantPorDia.get(day) || 0,
    midias: midiasPorDia.get(day) || 0,
    conversas: conversasPorDia.get(day) || 0,
  }));

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
      membros: Number(membrosRes.count || 0),
      ultima_atividade: ultimaAtividade,
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
      membros: Number(membrosRes.count || 0),
      midias_total: Number(midiasTotalRes.count || 0),
      midias_periodo: midiasPeriodo.length,
      conversas_periodo: conversas.length,
      mensagens_usuario_periodo: msgsUser,
      mensagens_assistente_periodo: msgsAssistant,
    },
    fluxo: {
      mensagens_usuario: msgsUser,
      mensagens_assistente: msgsAssistant,
      midias: midiasPeriodo.length,
      conversas: conversas.length,
    },
    evolucao,
  };
}
