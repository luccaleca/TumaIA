import { getSupabaseAdmin } from "../../supabaseAdmin.js";
import {
  dayKeyFromIso,
  resolveDashboardRange,
  shiftYmd,
  ymdFromInstant,
} from "./dateRange.js";

/**
 * Agrega métricas reais do TumaIA para o dashboard TumaCore (ops).
 * Não usa schema legado tb_* do repositório TumaCore.
 *
 * @param {{ period?: string|number, from?: string, to?: string }} query
 */
export async function loadPlataformaDashboard(query = {}) {
  const db = getSupabaseAdmin();
  if (!db) {
    const err = new Error("Supabase não configurado no servidor");
    err.status = 503;
    throw err;
  }

  const range = resolveDashboardRange(query);
  const { startIso, endIsoExclusive } = range;

  const [
    empresasRes,
    usuariosRes,
    vinculosRes,
    midiasRes,
    midiasPeriodoRowsRes,
    conversasRowsRes,
    mensagensUserRes,
    mensagensAssistantRes,
    mensagensRowsRes,
  ] = await Promise.all([
    db.from("empresa").select("id_empresa, nome_fantasia, segmento, ativo, data_criacao"),
    db.from("usuario").select("id_usuario", { count: "exact", head: true }),
    db.from("usuario_empresa").select("id_empresa, id_usuario, ativo").eq("ativo", true),
    db.from("midia").select("id_empresa", { count: "exact", head: true }).eq("ativo", true),
    db
      .from("midia")
      .select("id_empresa, data_criacao")
      .eq("ativo", true)
      .gte("data_criacao", startIso)
      .lt("data_criacao", endIsoExclusive)
      .limit(5000),
    db
      .from("chat_conversa")
      .select("id_conversa, id_empresa, data_atualizacao")
      .eq("ativo", true)
      .gte("data_atualizacao", startIso)
      .lt("data_atualizacao", endIsoExclusive)
      .limit(5000),
    db
      .from("chat_mensagem")
      .select("id_mensagem", { count: "exact", head: true })
      .eq("papel", "user")
      .gte("data_criacao", startIso)
      .lt("data_criacao", endIsoExclusive),
    db
      .from("chat_mensagem")
      .select("id_mensagem", { count: "exact", head: true })
      .eq("papel", "assistant")
      .gte("data_criacao", startIso)
      .lt("data_criacao", endIsoExclusive),
    db
      .from("chat_mensagem")
      .select("data_criacao, papel")
      .in("papel", ["user", "assistant"])
      .gte("data_criacao", startIso)
      .lt("data_criacao", endIsoExclusive)
      .limit(8000),
  ]);

  const firstError =
    empresasRes.error ||
    usuariosRes.error ||
    vinculosRes.error ||
    midiasRes.error ||
    midiasPeriodoRowsRes.error ||
    conversasRowsRes.error ||
    mensagensUserRes.error ||
    mensagensAssistantRes.error ||
    mensagensRowsRes.error;
  if (firstError) {
    const err = new Error(firstError.message || "Falha ao agregar dashboard");
    err.status = 500;
    throw err;
  }

  const empresas = Array.isArray(empresasRes.data) ? empresasRes.data : [];
  const vinculos = Array.isArray(vinculosRes.data) ? vinculosRes.data : [];
  const conversas = Array.isArray(conversasRowsRes.data) ? conversasRowsRes.data : [];
  const midiasPeriodo = Array.isArray(midiasPeriodoRowsRes.data) ? midiasPeriodoRowsRes.data : [];
  const msgsRows = Array.isArray(mensagensRowsRes.data) ? mensagensRowsRes.data : [];

  const membrosPorEmpresa = new Map();
  for (const v of vinculos) {
    const id = String(v.id_empresa || "");
    if (!id) continue;
    membrosPorEmpresa.set(id, (membrosPorEmpresa.get(id) || 0) + 1);
  }

  const conversasPorEmpresa = new Map();
  const ultimaAtividade = new Map();
  for (const c of conversas) {
    const id = String(c.id_empresa || "");
    if (!id) continue;
    conversasPorEmpresa.set(id, (conversasPorEmpresa.get(id) || 0) + 1);
    const ts = c.data_atualizacao;
    if (ts && (!ultimaAtividade.has(id) || String(ts) > String(ultimaAtividade.get(id)))) {
      ultimaAtividade.set(id, ts);
    }
  }

  const midiasPorEmpresa = new Map();
  const midiasPorDia = new Map();
  for (const m of midiasPeriodo) {
    const id = String(m.id_empresa || "");
    if (id) midiasPorEmpresa.set(id, (midiasPorEmpresa.get(id) || 0) + 1);
    const day = dayKeyFromIso(m.data_criacao);
    if (day) midiasPorDia.set(day, (midiasPorDia.get(day) || 0) + 1);
    if (id && m.data_criacao) {
      if (!ultimaAtividade.has(id) || String(m.data_criacao) > String(ultimaAtividade.get(id))) {
        ultimaAtividade.set(id, m.data_criacao);
      }
    }
  }

  const msgsUserPorDia = new Map();
  const msgsAssistantPorDia = new Map();
  for (const m of msgsRows) {
    const day = dayKeyFromIso(m.data_criacao);
    if (!day) continue;
    if (m.papel === "user") msgsUserPorDia.set(day, (msgsUserPorDia.get(day) || 0) + 1);
    if (m.papel === "assistant") {
      msgsAssistantPorDia.set(day, (msgsAssistantPorDia.get(day) || 0) + 1);
    }
  }

  const conversasPorDia = new Map();
  for (const c of conversas) {
    const day = dayKeyFromIso(c.data_atualizacao);
    if (day) conversasPorDia.set(day, (conversasPorDia.get(day) || 0) + 1);
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

  const msgsUser = Number(mensagensUserRes.count || 0);
  const msgsAssistant = Number(mensagensAssistantRes.count || 0);

  const porSegmento = {};
  for (const e of empresas) {
    const seg = String(e.segmento || "outros").trim() || "outros";
    porSegmento[seg] = (porSegmento[seg] || 0) + 1;
  }

  const empresasAtivas = empresas.filter((e) => e.ativo !== false).length;
  const empresasComChatNoPeriodo = [...conversasPorEmpresa.keys()].length;

  const rows = empresas
    .map((e) => {
      const id = String(e.id_empresa);
      return {
        id_empresa: id,
        nome_fantasia: String(e.nome_fantasia || "").trim() || "Empresa",
        segmento: String(e.segmento || "").trim() || "—",
        ativo: e.ativo !== false,
        membros: membrosPorEmpresa.get(id) || 0,
        conversas_periodo: conversasPorEmpresa.get(id) || 0,
        midias_periodo: midiasPorEmpresa.get(id) || 0,
        ultima_atividade: ultimaAtividade.get(id) || null,
        data_criacao: e.data_criacao || null,
      };
    })
    .sort(
      (a, b) =>
        b.conversas_periodo - a.conversas_periodo ||
        a.nome_fantasia.localeCompare(b.nome_fantasia, "pt-BR"),
    );

  return {
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
      empresas_total: empresas.length,
      empresas_ativas: empresasAtivas,
      empresas_com_chat_periodo: empresasComChatNoPeriodo,
      usuarios_total: Number(usuariosRes.count || 0),
      midias_total: Number(midiasRes.count || 0),
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
    por_segmento: Object.entries(porSegmento)
      .map(([segmento, total]) => ({ segmento, total }))
      .sort((a, b) => b.total - a.total),
    empresas: rows,
  };
}
