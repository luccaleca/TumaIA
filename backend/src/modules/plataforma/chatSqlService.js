import { getSupabaseAdmin } from "../../supabaseAdmin.js";
import { isCloudChatLlm } from "../../config.js";
import { promptCloudChat } from "../../services/cloudChatService.js";

const FORBIDDEN_SQL = /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|merge|call|execute|copy|pg_sleep)\b/i;
const SELECT_START = /^(with\b[\s\S]+?\bselect\b|select\b)/i;

/**
 * Validação rigorosa: somente SELECT ou WITH ... SELECT, sem múltiplos statements.
 */
export function validateSelectOnly(rawSql) {
  const sql = String(rawSql || "").trim().replace(/;+\s*$/, "").trim();
  if (!sql) throw new Error("Consulta SQL vazia.");
  if (sql.includes(";")) {
    throw new Error("Apenas uma instrução SQL por consulta é permitida.");
  }
  if (FORBIDDEN_SQL.test(sql)) {
    throw new Error("Apenas consultas SELECT de leitura são permitidas no Chat SQL.");
  }
  if (!SELECT_START.test(sql)) {
    throw new Error("A consulta deve ser um SELECT ou WITH ... SELECT.");
  }
  return sql;
}

/**
 * Schema de tabelas do TumaIA para instruir a LLM e consultas
 */
export const TUMAIA_SCHEMA_HINT = `
Tabelas disponíveis no PostgreSQL do TumaIA (schema public):
- empresa (id_empresa UUID, nome_fantasia VARCHAR, razao_social VARCHAR, cnpj VARCHAR, email_principal VARCHAR, telefone VARCHAR, segmento VARCHAR, ativo BOOLEAN, data_criacao TIMESTAMPTZ)
- usuario (id_usuario UUID, auth_user_id UUID, nome VARCHAR, email VARCHAR, telefone VARCHAR, ativo BOOLEAN, dono_plataforma BOOLEAN, data_criacao TIMESTAMPTZ)
- usuario_empresa (id_usuario_empresa UUID, id_usuario UUID, id_empresa UUID, cargo VARCHAR, ativo BOOLEAN, criado_em TIMESTAMPTZ)
- conversas (id UUID, id_empresa UUID, canal VARCHAR, titulo VARCHAR, created_at TIMESTAMPTZ)
- mensagens (id UUID, id_conversa UUID, role VARCHAR, content TEXT, created_at TIMESTAMPTZ)
- midias (id UUID, id_empresa UUID, storage_path TEXT, nome_arquivo VARCHAR, mime_type VARCHAR, tamanho_bytes BIGINT, tipo VARCHAR, ativo BOOLEAN, criado_em TIMESTAMPTZ)
- assinatura_empresa (id_assinatura UUID, id_empresa UUID, id_plano UUID, status VARCHAR, data_inicio TIMESTAMPTZ, data_fim TIMESTAMPTZ, email_assinatura VARCHAR, data_criacao TIMESTAMPTZ)
`;

export const SUGESTOES_CHAT_SQL = [
  "Quantas empresas temos cadastradas e qual o status delas?",
  "Quais são as empresas ativas no sistema?",
  "Top 5 empresas com maior volume de mensagens",
  "Últimos 10 usuários cadastrados na plataforma",
  "Volume de mídias cadastradas por tipo de arquivo",
  "Membros ativos vinculados por empresa",
  "Status das assinaturas e planos ativos",
];

/** Amostra realista para visualização offline ou quando o Supabase estiver em manutenção */
function getSimulatedFallbackData(sqlIntent) {
  const now = new Date().toISOString();
  if (sqlIntent === "empresas_status" || sqlIntent === "empresas_count") {
    return {
      columns: ["total", "ativas", "inativas"],
      rows: [{ total: 6, ativas: 5, inativas: 1 }],
      answer: "Atualmente existem 6 empresas registradas na plataforma TumaIA: 5 ativas e 1 inativa.",
    };
  }
  if (sqlIntent === "usuarios") {
    return {
      columns: ["nome", "email", "telefone", "dono_plataforma", "ativo", "data_criacao"],
      rows: [
        { nome: "Lucca Admin", email: "luccaleca@gmail.com", telefone: "(11) 98765-4321", dono_plataforma: true, ativo: true, data_criacao: now },
        { nome: "Carlos Suplementos", email: "carlos@vitalplus.com.br", telefone: "(11) 99123-4567", dono_plataforma: false, ativo: true, data_criacao: now },
        { nome: "Mariana Moda", email: "mari@boutiqueaura.com", telefone: "(21) 98234-5678", dono_plataforma: false, ativo: true, data_criacao: now },
      ],
      answer: "Aqui estão os usuários mais recentes cadastrados na plataforma TumaIA.",
    };
  }
  if (sqlIntent === "top_chat" || sqlIntent === "mensagens") {
    return {
      columns: ["nome_fantasia", "total_mensagens"],
      rows: [
        { nome_fantasia: "VitalPlus Suplementos", total_mensagens: 142 },
        { nome_fantasia: "Boutique Aura", total_mensagens: 89 },
        { nome_fantasia: "Café Gourmet Brasil", total_mensagens: 45 },
      ],
      answer: "Ranking de empresas com maior volume de mensagens geradas no agente Tuma.",
    };
  }
  if (sqlIntent === "midias") {
    return {
      columns: ["tipo", "total_arquivos", "tamanho_total_mb"],
      rows: [
        { tipo: "produto", total_arquivos: 28, tamanho_total_mb: "14.2" },
        { tipo: "logo", total_arquivos: 6, tamanho_total_mb: "2.1" },
        { tipo: "gerada", total_arquivos: 54, tamanho_total_mb: "48.7" },
      ],
      answer: "Distribuição das mídias enviadas pelas empresas no acervo por categoria.",
    };
  }
  if (sqlIntent === "membros") {
    return {
      columns: ["nome_fantasia", "total_membros"],
      rows: [
        { nome_fantasia: "VitalPlus Suplementos", total_membros: 3 },
        { nome_fantasia: "Boutique Aura", total_membros: 2 },
        { nome_fantasia: "Café Gourmet Brasil", total_membros: 1 },
      ],
      answer: "Quantidade de membros e colaboradores com vínculo ativo por empresa.",
    };
  }
  if (sqlIntent === "assinaturas") {
    return {
      columns: ["nome_fantasia", "status", "email_assinatura", "data_inicio"],
      rows: [
        { nome_fantasia: "VitalPlus Suplementos", status: "ativo", email_assinatura: "financeiro@vitalplus.com", data_inicio: now.slice(0, 10) },
        { nome_fantasia: "Boutique Aura", status: "trial", email_assinatura: "mari@boutiqueaura.com", data_inicio: now.slice(0, 10) },
      ],
      answer: "Status das assinaturas e planos das empresas cadastradas.",
    };
  }
  // Padrão empresas
  return {
    columns: ["nome_fantasia", "segmento", "email_principal", "ativo", "data_criacao"],
    rows: [
      { nome_fantasia: "VitalPlus Suplementos", segmento: "Saúde & Fitness", email_principal: "contato@vitalplus.com.br", ativo: true, data_criacao: now },
      { nome_fantasia: "Boutique Aura", segmento: "Moda & Acessórios", email_principal: "contato@boutiqueaura.com", ativo: true, data_criacao: now },
      { nome_fantasia: "Café Gourmet Brasil", segmento: "Alimentos & Bebidas", email_principal: "contato@cafegourmet.com", ativo: true, data_criacao: now },
      { nome_fantasia: "Studio Pilates Equilíbrio", segmento: "Serviços", email_principal: "contato@studiopilates.com", ativo: true, data_criacao: now },
      { nome_fantasia: "Móveis Rústicos Arte", segmento: "Decoração", email_principal: "contato@moveisrusticos.com", ativo: false, data_criacao: now },
    ],
    answer: "Aqui estão as empresas cadastradas no sistema TumaIA.",
  };
}

/**
 * Detecta o padrão ou gera a query SQL adequada para a pergunta.
 */
function inferSqlFromText(text) {
  const t = text.trim();
  // Se já é um comando SQL direto
  if (/^(select|with)\b/i.test(t)) {
    const valid = validateSelectOnly(t);
    return { sql: valid, intent: "custom_sql" };
  }

  const lower = t.toLowerCase();

  if (/quant(as|os)\s+empresas|total\s+de\s+empresas|status\s+d(as|e)\s+empresas/i.test(lower)) {
    return {
      sql: `SELECT 
  count(*) AS total,
  count(*) FILTER (WHERE ativo = true) AS ativas,
  count(*) FILTER (WHERE ativo = false) AS inativas
FROM public.empresa;`,
      intent: "empresas_status",
    };
  }

  if (/top\s*\d*|mais\s+mensagens|mais\s+conversas|ranking\s+chat/i.test(lower)) {
    return {
      sql: `SELECT 
  e.nome_fantasia,
  count(m.id) AS total_mensagens
FROM public.empresa e
LEFT JOIN public.conversas c ON c.id_empresa = e.id_empresa
LEFT JOIN public.mensagens m ON m.id_conversa = c.id
GROUP BY e.nome_fantasia
ORDER BY total_mensagens DESC
LIMIT 10;`,
      intent: "top_chat",
    };
  }

  if (/usu[aá]rios?\s+(recentes?|cadastrados?|novos?)|quais\s+s[aã]o\s+os\s+usu[aá]rios/i.test(lower)) {
    return {
      sql: `SELECT 
  nome,
  email,
  telefone,
  dono_plataforma,
  ativo,
  data_criacao
FROM public.usuario
ORDER BY data_criacao DESC
LIMIT 50;`,
      intent: "usuarios",
    };
  }

  if (/m[ií]dias?|arquivos?|imagens?|fotos?\s+d(o|e)\s+acervo/i.test(lower)) {
    return {
      sql: `SELECT 
  tipo,
  count(*) AS total_arquivos,
  round(sum(tamanho_bytes) / 1048576.0, 2) AS tamanho_total_mb
FROM public.midias
WHERE ativo = true
GROUP BY tipo
ORDER BY total_arquivos DESC;`,
      intent: "midias",
    };
  }

  if (/membros?|funcion[aá]rios?|colaboradores?|v[ií]nculos?/i.test(lower)) {
    return {
      sql: `SELECT 
  e.nome_fantasia,
  count(ue.id_usuario) AS total_membros
FROM public.empresa e
LEFT JOIN public.usuario_empresa ue ON ue.id_empresa = e.id_empresa AND ue.ativo = true
GROUP BY e.nome_fantasia
ORDER BY total_membros DESC;`,
      intent: "membros",
    };
  }

  if (/assinaturas?|planos?|faturamento|pagamentos?/i.test(lower)) {
    return {
      sql: `SELECT 
  e.nome_fantasia,
  a.status,
  a.email_assinatura,
  a.data_inicio,
  a.data_fim
FROM public.assinatura_empresa a
JOIN public.empresa e ON e.id_empresa = a.id_empresa
ORDER BY a.data_criacao DESC
LIMIT 50;`,
      intent: "assinaturas",
    };
  }

  // Padrão: listagem de empresas
  return {
    sql: `SELECT 
  nome_fantasia,
  segmento,
  email_principal,
  ativo,
  data_criacao
FROM public.empresa
ORDER BY data_criacao DESC
LIMIT 50;`,
    intent: "empresas",
  };
}

/**
 * Executa a consulta de forma segura no Supabase PostgREST
 */
async function executeSafeQuery(intent, db) {
  if (intent === "empresas_status") {
    const { data, error } = await db.from("empresa").select("ativo");
    if (error) throw error;
    const all = data || [];
    const ativas = all.filter((e) => e.ativo).length;
    const inativas = all.length - ativas;
    return {
      columns: ["total", "ativas", "inativas"],
      rows: [{ total: all.length, ativas, inativas }],
      answer: `Existem ${all.length} empresas cadastradas no TumaIA: ${ativas} ativas e ${inativas} inativas.`,
    };
  }

  if (intent === "top_chat") {
    const [empRes, convRes, msgRes] = await Promise.all([
      db.from("empresa").select("id_empresa, nome_fantasia"),
      db.from("conversas").select("id, id_empresa"),
      db.from("mensagens").select("id, id_conversa"),
    ]);
    if (empRes.error) throw empRes.error;
    const empMap = new Map((empRes.data || []).map((e) => [String(e.id_empresa), e.nome_fantasia]));
    const convToEmp = new Map((convRes.data || []).map((c) => [String(c.id), String(c.id_empresa)]));
    const counts = new Map();
    for (const m of msgRes.data || []) {
      const empId = convToEmp.get(String(m.id_conversa));
      if (empId) {
        counts.set(empId, (counts.get(empId) || 0) + 1);
      }
    }
    const rows = Array.from(counts.entries())
      .map(([empId, total_mensagens]) => ({
        nome_fantasia: empMap.get(empId) || "Empresa",
        total_mensagens,
      }))
      .sort((a, b) => b.total_mensagens - a.total_mensagens)
      .slice(0, 10);
    return {
      columns: ["nome_fantasia", "total_mensagens"],
      rows,
      answer: `Ranking das ${rows.length} empresas com maior volume de mensagens geradas.`,
    };
  }

  if (intent === "usuarios") {
    const { data, error } = await db
      .from("usuario")
      .select("nome, email, telefone, ativo, data_criacao")
      .order("data_criacao", { ascending: false })
      .limit(50);
    if (error) throw error;
    return {
      columns: ["nome", "email", "telefone", "ativo", "data_criacao"],
      rows: data || [],
      answer: `Listagem dos ${(data || []).length} usuários mais recentes da plataforma.`,
    };
  }

  if (intent === "midias") {
    const { data, error } = await db
      .from("midias")
      .select("tipo, tamanho_bytes")
      .eq("ativo", true);
    if (error) throw error;
    const tipos = new Map();
    for (const m of data || []) {
      const t = m.tipo || "outro";
      const bytes = Number(m.tamanho_bytes) || 0;
      const cur = tipos.get(t) || { total_arquivos: 0, bytes: 0 };
      cur.total_arquivos++;
      cur.bytes += bytes;
      tipos.set(t, cur);
    }
    const rows = Array.from(tipos.entries()).map(([tipo, stats]) => ({
      tipo,
      total_arquivos: stats.total_arquivos,
      tamanho_total_mb: (stats.bytes / (1024 * 1024)).toFixed(2),
    }));
    return {
      columns: ["tipo", "total_arquivos", "tamanho_total_mb"],
      rows,
      answer: `Distribuição de mídias por categoria de arquivo.`,
    };
  }

  if (intent === "membros") {
    const [empRes, vinRes] = await Promise.all([
      db.from("empresa").select("id_empresa, nome_fantasia").eq("ativo", true),
      db.from("usuario_empresa").select("id_empresa").eq("ativo", true),
    ]);
    if (empRes.error) throw empRes.error;
    const counts = new Map();
    for (const v of vinRes.data || []) {
      const eid = String(v.id_empresa);
      counts.set(eid, (counts.get(eid) || 0) + 1);
    }
    const rows = (empRes.data || [])
      .map((e) => ({
        nome_fantasia: e.nome_fantasia,
        total_membros: counts.get(String(e.id_empresa)) || 0,
      }))
      .sort((a, b) => b.total_membros - a.total_membros);
    return {
      columns: ["nome_fantasia", "total_membros"],
      rows,
      answer: `Membros ativos vinculados por empresa.`,
    };
  }

  if (intent === "assinaturas") {
    const { data, error } = await db
      .from("assinatura_empresa")
      .select("status, email_assinatura, data_inicio, data_fim, id_empresa")
      .limit(50);
    if (error) throw error;
    return {
      columns: ["status", "email_assinatura", "data_inicio", "data_fim"],
      rows: data || [],
      answer: `Status das assinaturas registradas.`,
    };
  }

  // Padrão empresas
  const { data, error } = await db
    .from("empresa")
    .select("nome_fantasia, segmento, email_principal, ativo, data_criacao")
    .order("data_criacao", { ascending: false })
    .limit(50);
  if (error) throw error;
  return {
    columns: ["nome_fantasia", "segmento", "email_principal", "ativo", "data_criacao"],
    rows: data || [],
    answer: `Encontradas ${(data || []).length} empresas cadastradas no sistema.`,
  };
}

/**
 * Processa a mensagem do Chat SQL
 * @param {{ message: string, history?: Array<{ role: string, content: string }> }} input
 */
export async function processChatSqlMessage(input) {
  const startedAt = Date.now();
  const rawMessage = String(input?.message || "").trim();
  if (!rawMessage) {
    throw new Error("Mensagem não informada.");
  }

  const { sql, intent } = inferSqlFromText(rawMessage);
  const db = getSupabaseAdmin();

  let queryResult = null;
  let isSimulated = false;

  if (db) {
    try {
      queryResult = await executeSafeQuery(intent, db);
    } catch (dbErr) {
      console.warn("[chat-sql] DB query failed, falling back to simulated data:", dbErr.message);
      queryResult = getSimulatedFallbackData(intent);
      isSimulated = true;
    }
  } else {
    queryResult = getSimulatedFallbackData(intent);
    isSimulated = true;
  }

  const elapsed = Date.now() - startedAt;

  return {
    ok: true,
    userMessage: rawMessage,
    answer: queryResult.answer,
    sql,
    columns: queryResult.columns,
    rows: queryResult.rows,
    rowCount: (queryResult.rows || []).length,
    executionMs: elapsed,
    isSimulated,
    notice: isSimulated
      ? "Dados demonstrativos (banco Supabase em pausa ou desconectado)."
      : null,
    suggestions: SUGESTOES_CHAT_SQL.filter((s) => s.toLowerCase() !== rawMessage.toLowerCase()).slice(0, 4),
  };
}
