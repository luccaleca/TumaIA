import { getSupabaseAdmin } from "../../supabaseAdmin.js";
import {
  brazilDowHourFromIso,
  dayKeyFromIso,
  previousDashboardRange,
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

function deltaPct(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c === 0 ? 0 : 100;
  return Math.round(((c - p) / p) * 1000) / 10;
}

async function loadPeriodoEmpresa(db, idEmpresa, startIso, endIsoExclusive) {
  const [midiasRes, conversasRes] = await Promise.all([
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
  throwIfError(midiasRes, "Falha ao contar mídias da empresa");
  throwIfError(conversasRes, "Falha ao contar conversas da empresa");

  const midias = Array.isArray(midiasRes.data) ? midiasRes.data : [];
  const conversas = Array.isArray(conversasRes.data) ? conversasRes.data : [];
  const conversaIds = conversas.map((c) => String(c.id_conversa)).filter(Boolean);

  let msgs = [];
  if (conversaIds.length) {
    const mensagensRes = await db
      .from("chat_mensagem")
      .select("id_conversa, data_criacao, papel")
      .in("id_conversa", conversaIds)
      .eq("papel", "user")
      .gte("data_criacao", startIso)
      .lt("data_criacao", endIsoExclusive)
      .limit(8000);
    throwIfError(mensagensRes, "Falha ao contar mensagens da empresa");
    msgs = Array.isArray(mensagensRes.data) ? mensagensRes.data : [];
  }

  return { midias, conversas, msgs };
}

/**
 * Analytics TumaCore Empresa — filtrado por id_empresa autorizado.
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
    loadPeriodoEmpresa(db, idEmpresa, range.startIso, range.endIsoExclusive),
    loadPeriodoEmpresa(db, idEmpresa, prev.startIso, prev.endIsoExclusive),
  ]);

  const msgsNow = now.msgs.length;
  const msgsPrev = before.msgs.length;
  const midiasNow = now.midias.length;
  const midiasPrev = before.midias.length;
  const conversasNow = now.conversas.length;
  const conversasPrev = before.conversas.length;

  const msgsPorDia = new Map();
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const m of now.msgs) {
    const day = dayKeyFromIso(m.data_criacao);
    if (day) msgsPorDia.set(day, (msgsPorDia.get(day) || 0) + 1);
    const slot = brazilDowHourFromIso(m.data_criacao);
    if (slot) heatmap[slot.dow][slot.hour] += 1;
  }

  const midiasPorDia = new Map();
  for (const m of now.midias) {
    const day = dayKeyFromIso(m.data_criacao);
    if (day) midiasPorDia.set(day, (midiasPorDia.get(day) || 0) + 1);
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

  const trend = [...new Set(days)].map((day) => ({
    day,
    mensagens_usuario: msgsPorDia.get(day) || 0,
    midias: midiasPorDia.get(day) || 0,
  }));

  const emp = empresaRes.data;

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
    kpis: {
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
  };
}
