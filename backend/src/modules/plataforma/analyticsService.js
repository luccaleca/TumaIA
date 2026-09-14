import { getSupabaseAdmin } from "../../supabaseAdmin.js";
import {
  brazilDowHourFromIso,
  dayKeyFromIso,
  previousDashboardRange,
  resolveDashboardRange,
  shiftYmd,
  ymdFromInstant,
} from "./dateRange.js";

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

function deltaPct(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c === 0 ? 0 : 100;
  return Math.round(((c - p) / p) * 1000) / 10;
}

async function countUserMessages(db, startIso, endIsoExclusive) {
  const res = await db
    .from("chat_mensagem")
    .select("id_mensagem", { count: "exact", head: true })
    .eq("papel", "user")
    .gte("data_criacao", startIso)
    .lt("data_criacao", endIsoExclusive);
  throwIfError(res, "Falha ao contar mensagens");
  return Number(res.count || 0);
}

async function countMidias(db, startIso, endIsoExclusive) {
  const res = await db
    .from("midia")
    .select("id_midia", { count: "exact", head: true })
    .eq("ativo", true)
    .gte("data_criacao", startIso)
    .lt("data_criacao", endIsoExclusive);
  throwIfError(res, "Falha ao contar mídias");
  return Number(res.count || 0);
}

async function countConversas(db, startIso, endIsoExclusive) {
  const res = await db
    .from("chat_conversa")
    .select("id_conversa", { count: "exact", head: true })
    .eq("ativo", true)
    .gte("data_atualizacao", startIso)
    .lt("data_atualizacao", endIsoExclusive);
  throwIfError(res, "Falha ao contar conversas");
  return Number(res.count || 0);
}

/**
 * Analytics de plataforma (volume TumaIA — sem tb_analytics_*).
 * @param {{ period?: string|number, from?: string, to?: string }} query
 */
export async function loadPlataformaAnalytics(query = {}) {
  const db = requireDb();
  const range = resolveDashboardRange(query);
  const prev = previousDashboardRange(range);

  const [
    empresasRes,
    msgsNow,
    msgsPrev,
    midiasNow,
    midiasPrev,
    conversasNow,
    conversasPrev,
    midiasRowsRes,
    conversasRowsRes,
    mensagensRowsRes,
  ] = await Promise.all([
    db.from("empresa").select("id_empresa, nome_fantasia, ativo"),
    countUserMessages(db, range.startIso, range.endIsoExclusive),
    countUserMessages(db, prev.startIso, prev.endIsoExclusive),
    countMidias(db, range.startIso, range.endIsoExclusive),
    countMidias(db, prev.startIso, prev.endIsoExclusive),
    countConversas(db, range.startIso, range.endIsoExclusive),
    countConversas(db, prev.startIso, prev.endIsoExclusive),
    db
      .from("midia")
      .select("id_empresa, data_criacao")
      .eq("ativo", true)
      .gte("data_criacao", range.startIso)
      .lt("data_criacao", range.endIsoExclusive)
      .limit(5000),
    db
      .from("chat_conversa")
      .select("id_conversa, id_empresa, data_atualizacao")
      .eq("ativo", true)
      .gte("data_atualizacao", range.startIso)
      .lt("data_atualizacao", range.endIsoExclusive)
      .limit(5000),
    db
      .from("chat_mensagem")
      .select("id_conversa, data_criacao, papel")
      .eq("papel", "user")
      .gte("data_criacao", range.startIso)
      .lt("data_criacao", range.endIsoExclusive)
      .limit(8000),
  ]);

  for (const r of [empresasRes, midiasRowsRes, conversasRowsRes, mensagensRowsRes]) {
    throwIfError(r, "Falha ao agregar analytics");
  }

  const empresas = empresasRes.data || [];
  const empresasAtivas = empresas.filter((e) => e.ativo !== false).length;
  const nomeById = new Map(
    empresas.map((e) => [String(e.id_empresa), String(e.nome_fantasia || "").trim() || "Empresa"]),
  );

  const conversaToEmpresa = new Map(
    (conversasRowsRes.data || []).map((c) => [String(c.id_conversa), String(c.id_empresa)]),
  );

  const msgsPorEmpresa = new Map();
  const msgsPorDia = new Map();
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

  for (const m of mensagensRowsRes.data || []) {
    const day = dayKeyFromIso(m.data_criacao);
    if (day) msgsPorDia.set(day, (msgsPorDia.get(day) || 0) + 1);
    const empId = conversaToEmpresa.get(String(m.id_conversa));
    if (empId) msgsPorEmpresa.set(empId, (msgsPorEmpresa.get(empId) || 0) + 1);
    const slot = brazilDowHourFromIso(m.data_criacao);
    if (slot) heatmap[slot.dow][slot.hour] += 1;
  }

  const midiasPorEmpresa = new Map();
  const midiasPorDia = new Map();
  for (const m of midiasRowsRes.data || []) {
    const id = String(m.id_empresa || "");
    if (id) midiasPorEmpresa.set(id, (midiasPorEmpresa.get(id) || 0) + 1);
    const day = dayKeyFromIso(m.data_criacao);
    if (day) midiasPorDia.set(day, (midiasPorDia.get(day) || 0) + 1);
  }

  const conversasPorEmpresa = new Map();
  for (const c of conversasRowsRes.data || []) {
    const id = String(c.id_empresa || "");
    if (!id) continue;
    conversasPorEmpresa.set(id, (conversasPorEmpresa.get(id) || 0) + 1);
  }

  const empresasComChat = conversasPorEmpresa.size;

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

  const trend = [...new Set(days)].map((day) => ({
    day,
    mensagens_usuario: msgsPorDia.get(day) || 0,
    midias: midiasPorDia.get(day) || 0,
  }));

  const ranking = [...nomeById.keys()]
    .map((id) => ({
      id_empresa: id,
      nome_fantasia: nomeById.get(id),
      mensagens_usuario: msgsPorEmpresa.get(id) || 0,
      midias: midiasPorEmpresa.get(id) || 0,
      conversas: conversasPorEmpresa.get(id) || 0,
    }))
    .filter((r) => r.mensagens_usuario || r.midias || r.conversas)
    .sort(
      (a, b) =>
        b.mensagens_usuario - a.mensagens_usuario ||
        b.midias - a.midias ||
        b.conversas - a.conversas,
    )
    .slice(0, 15);

  return {
    range: {
      label: range.label,
      period: range.period,
      from: range.from,
      to: range.to,
    },
    kpis: {
      empresas_ativas: empresasAtivas,
      empresas_com_chat: empresasComChat,
      mensagens_usuario: msgsNow,
      midias: midiasNow,
      conversas: conversasNow,
      delta: {
        mensagens_usuario: deltaPct(msgsNow, msgsPrev),
        midias: deltaPct(midiasNow, midiasPrev),
        conversas: deltaPct(conversasNow, conversasPrev),
      },
    },
    previous: {
      label: prev.label,
      mensagens_usuario: msgsPrev,
      midias: midiasPrev,
      conversas: conversasPrev,
    },
    trend,
    heatmap,
    ranking_empresas: ranking,
  };
}
