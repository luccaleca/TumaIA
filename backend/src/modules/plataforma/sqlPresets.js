import { getSupabaseAdmin } from "../../supabaseAdmin.js";
import { resolveDashboardRange } from "./dateRange.js";

/**
 * Consultas guiadas (substituto seguro do Chat SQL do Core).
 * Sem SQL livre e sem Chroma/FastAPI.
 */

export const SQL_PRESETS = [
  {
    id: "empresas_ativas",
    label: "Empresas ativas",
    description: "Lista nome, segmento e data de cadastro das empresas ativas.",
  },
  {
    id: "membros_por_empresa",
    label: "Membros por empresa",
    description: "Quantidade de vínculos ativos por empresa.",
  },
  {
    id: "top_chat_periodo",
    label: "Top chat no período",
    description: "Empresas com mais conversas atualizadas no período selecionado.",
  },
  {
    id: "midias_periodo",
    label: "Mídias novas no período",
    description: "Últimas mídias ativas criadas no período (até 100).",
  },
  {
    id: "msgs_user_periodo",
    label: "Mensagens do usuário no período",
    description: "Amostra de mensagens user no período (até 100).",
  },
  {
    id: "usuarios_recentes",
    label: "Usuários recentes",
    description: "Últimos usuários cadastrados (até 50).",
  },
  {
    id: "assinaturas",
    label: "Assinaturas",
    description: "Assinaturas por empresa (se houver dados em assinatura_empresa).",
  },
];

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

export function listSqlPresets() {
  return { presets: SQL_PRESETS };
}

/**
 * @param {string} presetId
 * @param {{ period?: string|number, from?: string, to?: string }} query
 */
export async function runSqlPreset(presetId, query = {}) {
  const id = String(presetId || "").trim();
  const preset = SQL_PRESETS.find((p) => p.id === id);
  if (!preset) {
    const err = new Error("Consulta desconhecida");
    err.status = 404;
    throw err;
  }

  const db = requireDb();
  const range = resolveDashboardRange(query);

  if (id === "empresas_ativas") {
    const res = await db
      .from("empresa")
      .select("nome_fantasia, segmento, email_principal, data_criacao")
      .eq("ativo", true)
      .order("nome_fantasia", { ascending: true })
      .limit(100);
    throwIfError(res, "Falha na consulta");
    return { preset, range: { label: range.label }, columns: ["nome_fantasia", "segmento", "email_principal", "data_criacao"], rows: res.data || [] };
  }

  if (id === "membros_por_empresa") {
    const [empRes, vinRes] = await Promise.all([
      db.from("empresa").select("id_empresa, nome_fantasia").eq("ativo", true),
      db.from("usuario_empresa").select("id_empresa").eq("ativo", true),
    ]);
    throwIfError(empRes, "Falha na consulta");
    throwIfError(vinRes, "Falha na consulta");
    const counts = new Map();
    for (const v of vinRes.data || []) {
      const eid = String(v.id_empresa);
      counts.set(eid, (counts.get(eid) || 0) + 1);
    }
    const rows = (empRes.data || [])
      .map((e) => ({
        nome_fantasia: e.nome_fantasia,
        membros: counts.get(String(e.id_empresa)) || 0,
      }))
      .sort((a, b) => b.membros - a.membros);
    return {
      preset,
      range: { label: range.label },
      columns: ["nome_fantasia", "membros"],
      rows,
    };
  }

  if (id === "top_chat_periodo") {
    const [empRes, convRes] = await Promise.all([
      db.from("empresa").select("id_empresa, nome_fantasia"),
      db
        .from("chat_conversa")
        .select("id_empresa")
        .eq("ativo", true)
        .gte("data_atualizacao", range.startIso)
        .lt("data_atualizacao", range.endIsoExclusive),
    ]);
    throwIfError(empRes, "Falha na consulta");
    throwIfError(convRes, "Falha na consulta");
    const nome = new Map((empRes.data || []).map((e) => [String(e.id_empresa), e.nome_fantasia]));
    const counts = new Map();
    for (const c of convRes.data || []) {
      const eid = String(c.id_empresa);
      counts.set(eid, (counts.get(eid) || 0) + 1);
    }
    const rows = [...counts.entries()]
      .map(([id_empresa, conversas]) => ({
        nome_fantasia: nome.get(id_empresa) || id_empresa,
        conversas,
      }))
      .sort((a, b) => b.conversas - a.conversas)
      .slice(0, 50);
    return {
      preset,
      range: { label: range.label, from: range.from, to: range.to },
      columns: ["nome_fantasia", "conversas"],
      rows,
    };
  }

  if (id === "midias_periodo") {
    const res = await db
      .from("midia")
      .select("nome_exibicao, tipo_midia, id_empresa, data_criacao")
      .eq("ativo", true)
      .gte("data_criacao", range.startIso)
      .lt("data_criacao", range.endIsoExclusive)
      .order("data_criacao", { ascending: false })
      .limit(100);
    throwIfError(res, "Falha na consulta");
    return {
      preset,
      range: { label: range.label },
      columns: ["nome_exibicao", "tipo_midia", "id_empresa", "data_criacao"],
      rows: res.data || [],
    };
  }

  if (id === "msgs_user_periodo") {
    const res = await db
      .from("chat_mensagem")
      .select("id_conversa, conteudo, data_criacao")
      .eq("papel", "user")
      .gte("data_criacao", range.startIso)
      .lt("data_criacao", range.endIsoExclusive)
      .order("data_criacao", { ascending: false })
      .limit(100);
    throwIfError(res, "Falha na consulta");
    const rows = (res.data || []).map((m) => ({
      id_conversa: m.id_conversa,
      conteudo: String(m.conteudo || "").slice(0, 160),
      data_criacao: m.data_criacao,
    }));
    return {
      preset,
      range: { label: range.label },
      columns: ["id_conversa", "conteudo", "data_criacao"],
      rows,
    };
  }

  if (id === "usuarios_recentes") {
    const res = await db
      .from("usuario")
      .select("nome, email, telefone, ativo, data_criacao")
      .order("data_criacao", { ascending: false })
      .limit(50);
    throwIfError(res, "Falha na consulta");
    return {
      preset,
      range: { label: range.label },
      columns: ["nome", "email", "telefone", "ativo", "data_criacao"],
      rows: res.data || [],
    };
  }

  if (id === "assinaturas") {
    const [assRes, empRes, planoRes] = await Promise.all([
      db.from("assinatura_empresa").select("id_empresa, id_plano, status, data_inicio, data_fim").limit(100),
      db.from("empresa").select("id_empresa, nome_fantasia"),
      db.from("plano").select("id_plano, nome"),
    ]);
    if (assRes.error) {
      return {
        preset,
        range: { label: range.label },
        columns: ["aviso"],
        rows: [{ aviso: assRes.error.message || "Sem acesso a assinatura_empresa" }],
      };
    }
    const nomeEmp = new Map((empRes.data || []).map((e) => [String(e.id_empresa), e.nome_fantasia]));
    const nomePlano = new Map((planoRes.data || []).map((p) => [String(p.id_plano), p.nome]));
    const rows = (assRes.data || []).map((a) => ({
      empresa: nomeEmp.get(String(a.id_empresa)) || a.id_empresa,
      plano: nomePlano.get(String(a.id_plano)) || a.id_plano,
      status: a.status,
      data_inicio: a.data_inicio,
      data_fim: a.data_fim,
    }));
    return {
      preset,
      range: { label: range.label },
      columns: ["empresa", "plano", "status", "data_inicio", "data_fim"],
      rows,
    };
  }

  const err = new Error("Consulta não implementada");
  err.status = 501;
  throw err;
}
