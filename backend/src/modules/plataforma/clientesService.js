import { getSupabaseAdmin } from "../../supabaseAdmin.js";
import { resolveDashboardRange } from "./dateRange.js";

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
 * Lista empresas da plataforma com atividade recente.
 * @param {{ period?: string|number, from?: string, to?: string, filtro?: string, q?: string }} query
 */
export async function loadPlataformaClientes(query = {}) {
  const db = requireDb();
  const range = resolveDashboardRange(query);
  const filtro = String(query.filtro || "todos").trim().toLowerCase();
  const q = String(query.q || "")
    .trim()
    .toLowerCase();

  const [empresasRes, vinculosRes, midiasRes, midiasPeriodoRes, conversasRes, assinaturasRes] =
    await Promise.all([
      db
        .from("empresa")
        .select(
          "id_empresa, nome_fantasia, razao_social, segmento, cnpj, email_principal, telefone_principal, instagram_empresa, ativo, data_criacao",
        )
        .order("nome_fantasia", { ascending: true }),
      db.from("usuario_empresa").select("id_empresa, id_usuario, ativo").eq("ativo", true),
      db.from("midia").select("id_empresa").eq("ativo", true),
      db
        .from("midia")
        .select("id_empresa, data_criacao")
        .eq("ativo", true)
        .gte("data_criacao", range.startIso)
        .lt("data_criacao", range.endIsoExclusive),
      db
        .from("chat_conversa")
        .select("id_empresa, data_atualizacao")
        .eq("ativo", true)
        .gte("data_atualizacao", range.startIso)
        .lt("data_atualizacao", range.endIsoExclusive),
      db.from("assinatura_empresa").select("id_empresa, status, id_plano, data_fim"),
    ]);

  for (const r of [empresasRes, vinculosRes, midiasRes, midiasPeriodoRes, conversasRes]) {
    throwIfError(r, "Falha ao listar clientes");
  }
  // assinatura é opcional — se a tabela estiver vazia/restrita, segue sem badge
  const assinaturaByEmpresa = new Map();
  if (!assinaturasRes.error) {
    for (const a of assinaturasRes.data || []) {
      const id = String(a.id_empresa || "");
      if (!id) continue;
      const prev = assinaturaByEmpresa.get(id);
      if (!prev || String(a.data_fim || "") > String(prev.data_fim || "")) {
        assinaturaByEmpresa.set(id, { status: a.status, id_plano: a.id_plano });
      }
    }
  }

  const membrosPorEmpresa = new Map();
  for (const v of vinculosRes.data || []) {
    const id = String(v.id_empresa || "");
    if (!id) continue;
    membrosPorEmpresa.set(id, (membrosPorEmpresa.get(id) || 0) + 1);
  }

  const midiasPorEmpresa = new Map();
  for (const m of midiasRes.data || []) {
    const id = String(m.id_empresa || "");
    if (!id) continue;
    midiasPorEmpresa.set(id, (midiasPorEmpresa.get(id) || 0) + 1);
  }

  const midiasPeriodoPorEmpresa = new Map();
  const ultimaAtividade = new Map();
  for (const m of midiasPeriodoRes.data || []) {
    const id = String(m.id_empresa || "");
    if (!id) continue;
    midiasPeriodoPorEmpresa.set(id, (midiasPeriodoPorEmpresa.get(id) || 0) + 1);
    const ts = m.data_criacao;
    if (ts && (!ultimaAtividade.has(id) || String(ts) > String(ultimaAtividade.get(id)))) {
      ultimaAtividade.set(id, ts);
    }
  }

  const conversasPorEmpresa = new Map();
  for (const c of conversasRes.data || []) {
    const id = String(c.id_empresa || "");
    if (!id) continue;
    conversasPorEmpresa.set(id, (conversasPorEmpresa.get(id) || 0) + 1);
    const ts = c.data_atualizacao;
    if (ts && (!ultimaAtividade.has(id) || String(ts) > String(ultimaAtividade.get(id)))) {
      ultimaAtividade.set(id, ts);
    }
  }

  let rows = (empresasRes.data || []).map((e) => {
    const id = String(e.id_empresa);
    const conversas = conversasPorEmpresa.get(id) || 0;
    const midiasPeriodo = midiasPeriodoPorEmpresa.get(id) || 0;
    return {
      id_empresa: id,
      nome_fantasia: String(e.nome_fantasia || "").trim() || "Empresa",
      razao_social: String(e.razao_social || "").trim() || "—",
      segmento: String(e.segmento || "").trim() || "—",
      cnpj: String(e.cnpj || "").trim() || "—",
      email_principal: String(e.email_principal || "").trim() || "—",
      telefone_principal: String(e.telefone_principal || "").trim() || "—",
      instagram_empresa: String(e.instagram_empresa || "").trim() || "—",
      ativo: e.ativo !== false,
      membros: membrosPorEmpresa.get(id) || 0,
      midias_total: midiasPorEmpresa.get(id) || 0,
      midias_periodo: midiasPeriodo,
      conversas_periodo: conversas,
      ultima_atividade: ultimaAtividade.get(id) || null,
      data_criacao: e.data_criacao || null,
      assinatura_status: assinaturaByEmpresa.get(id)?.status || null,
    };
  });

  if (filtro === "ativos") rows = rows.filter((r) => r.ativo);
  else if (filtro === "inativos") rows = rows.filter((r) => !r.ativo);
  else if (filtro === "sem_atividade") {
    rows = rows.filter((r) => r.conversas_periodo === 0 && r.midias_periodo === 0);
  }

  if (q) {
    rows = rows.filter((r) => {
      const blob = `${r.nome_fantasia} ${r.razao_social} ${r.cnpj} ${r.email_principal} ${r.segmento}`.toLowerCase();
      return blob.includes(q);
    });
  }

  rows.sort(
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
    },
    filtro,
    total: rows.length,
    empresas: rows,
  };
}

/**
 * Detalhe de uma empresa (plataforma).
 * @param {string} idEmpresa
 * @param {{ period?: string|number, from?: string, to?: string }} query
 */
export async function loadPlataformaClienteDetalhe(idEmpresa, query = {}) {
  const id = String(idEmpresa || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    const err = new Error("id_empresa inválido");
    err.status = 400;
    throw err;
  }

  const db = requireDb();
  const range = resolveDashboardRange(query);

  const empresaRes = await db
    .from("empresa")
    .select(
      "id_empresa, nome_fantasia, razao_social, descricao, segmento, cnpj, email_principal, telefone_principal, instagram_empresa, site_empresa, ativo, data_criacao, data_atualizacao",
    )
    .eq("id_empresa", id)
    .maybeSingle();
  throwIfError(empresaRes, "Falha ao carregar empresa");
  if (!empresaRes.data) {
    const err = new Error("Empresa não encontrada");
    err.status = 404;
    throw err;
  }

  const [vinculosRes, midiasRes, midiasPeriodoRes, conversasRes] = await Promise.all([
    db
      .from("usuario_empresa")
      .select("id_usuario, cargo, perfil_acesso, ativo, data_criacao")
      .eq("id_empresa", id)
      .eq("ativo", true),
    db
      .from("midia")
      .select("id_midia, nome_exibicao, tipo_midia, data_criacao")
      .eq("id_empresa", id)
      .eq("ativo", true)
      .order("data_criacao", { ascending: false })
      .limit(12),
    db
      .from("midia")
      .select("id_midia", { count: "exact", head: true })
      .eq("id_empresa", id)
      .eq("ativo", true)
      .gte("data_criacao", range.startIso)
      .lt("data_criacao", range.endIsoExclusive),
    db
      .from("chat_conversa")
      .select("id_conversa, titulo, data_atualizacao, id_usuario")
      .eq("id_empresa", id)
      .eq("ativo", true)
      .order("data_atualizacao", { ascending: false })
      .limit(12),
  ]);

  for (const r of [vinculosRes, midiasRes, midiasPeriodoRes, conversasRes]) {
    throwIfError(r, "Falha ao carregar detalhe");
  }

  const userIds = [
    ...new Set(
      [...(vinculosRes.data || []), ...(conversasRes.data || [])]
        .map((x) => String(x.id_usuario || "").trim())
        .filter(Boolean),
    ),
  ];

  let usuariosById = new Map();
  if (userIds.length) {
    const usersRes = await db
      .from("usuario")
      .select("id_usuario, nome, email")
      .in("id_usuario", userIds);
    throwIfError(usersRes, "Falha ao carregar usuários");
    usuariosById = new Map((usersRes.data || []).map((u) => [String(u.id_usuario), u]));
  }

  const conversasPeriodo = (conversasRes.data || []).filter((c) => {
    const ts = String(c.data_atualizacao || "");
    return ts >= range.startIso && ts < range.endIsoExclusive;
  }).length;

  const e = empresaRes.data;
  return {
    range: {
      label: range.label,
      period: range.period,
      from: range.from,
      to: range.to,
    },
    empresa: {
      id_empresa: e.id_empresa,
      nome_fantasia: e.nome_fantasia,
      razao_social: e.razao_social,
      descricao: e.descricao,
      segmento: e.segmento,
      cnpj: e.cnpj,
      email_principal: e.email_principal,
      telefone_principal: e.telefone_principal,
      instagram_empresa: e.instagram_empresa,
      site_empresa: e.site_empresa || "",
      ativo: e.ativo !== false,
      data_criacao: e.data_criacao,
      data_atualizacao: e.data_atualizacao,
    },
    kpis: {
      membros: (vinculosRes.data || []).length,
      midias_recentes: (midiasRes.data || []).length,
      midias_periodo: Number(midiasPeriodoRes.count || 0),
      conversas_periodo: conversasPeriodo,
    },
    membros: (vinculosRes.data || []).map((v) => {
      const u = usuariosById.get(String(v.id_usuario)) || {};
      return {
        id_usuario: v.id_usuario,
        nome: u.nome || "—",
        email: u.email || "—",
        cargo: v.cargo,
        perfil_acesso: v.perfil_acesso,
        data_criacao: v.data_criacao,
      };
    }),
    midias_recentes: midiasRes.data || [],
    conversas_recentes: (conversasRes.data || []).map((c) => {
      const u = usuariosById.get(String(c.id_usuario)) || {};
      return {
        id_conversa: c.id_conversa,
        titulo: c.titulo || "Conversa",
        data_atualizacao: c.data_atualizacao,
        usuario_nome: u.nome || "—",
        usuario_email: u.email || "—",
      };
    }),
  };
}
