import { z } from "zod";
import {
  identidadeCompletude,
  mergeIdentidadePaletteFields,
  normalizeIdentidadeDados,
} from "../modules/empresas/identidadeMarca.js";
import { analisarIdentidadeMarca } from "./identidadeMarcaService.js";

const JOB_SELECT = [
  "id_identidade_analise_job",
  "id_empresa",
  "criado_por_usuario_id",
  "status",
  "payload_json",
  "progresso_json",
  "dados_base_json",
  "dados_resultado_json",
  "erro",
  "data_criacao",
  "data_atualizacao",
  "data_inicio",
  "data_fim",
].join(", ");

const jobCreateBody = z.object({
  midia_ids: z.array(z.string().uuid()).min(1).max(8),
  inclui_site: z.boolean().optional().default(false),
  dados_base: z.record(z.string(), z.unknown()).optional().default({}),
  site_url: z.string().max(500).optional(),
});

const TEXT_KEYS = [
  "sobre_empresa",
  "segmento",
  "tom_voz",
  "estilo_visual",
  "assinatura_visual",
  "variacoes_campanha",
  "regras_repeticao",
  "estrategia_cor_campanha",
  "evitar",
  "publico",
  "exemplo_frase_marca",
  "site_url",
  "legenda_referencia",
];

const runningJobs = new Set();

function cloneItems(items) {
  return Array.isArray(items)
    ? items.map((item) => ({
        id_midia: String(item?.id_midia ?? "").trim(),
        nome: String(item?.nome ?? "").trim(),
        preview_url: String(item?.preview_url ?? "").trim() || null,
        status: String(item?.status ?? "pending").trim() || "pending",
        error: String(item?.error ?? "").trim() || null,
      }))
    : [];
}

function normalizeProgress(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const items = cloneItems(src.items);
  return {
    fotoTotal: Math.max(0, Number(src.fotoTotal) || items.length || 0),
    fotoConcluidas: Math.max(0, Number(src.fotoConcluidas) || 0),
    fotoAtual: Math.max(0, Number(src.fotoAtual) || 0),
    fase: src.fase === "site" ? "site" : src.fase === "foto" ? "foto" : "foto",
    incluiSite: src.incluiSite === true,
    items,
  };
}

export function serializeIdentidadeAnaliseJobRow(row) {
  if (!row || typeof row !== "object") return null;
  const progress = normalizeProgress(row.progresso_json);
  const dadosResultado =
    row.dados_resultado_json && typeof row.dados_resultado_json === "object"
      ? normalizeIdentidadeDados(row.dados_resultado_json)
      : null;
  return {
    id_job: String(row.id_identidade_analise_job ?? "").trim() || null,
    status: String(row.status ?? "").trim() || "queued",
    progress,
    dados_base:
      row.dados_base_json && typeof row.dados_base_json === "object"
        ? normalizeIdentidadeDados(row.dados_base_json)
        : normalizeIdentidadeDados({}),
    dados_resultado: dadosResultado,
    completude: dadosResultado ? identidadeCompletude(dadosResultado) : null,
    error: String(row.erro ?? "").trim() || null,
    data_criacao: row.data_criacao ?? null,
    data_atualizacao: row.data_atualizacao ?? null,
    data_inicio: row.data_inicio ?? null,
    data_fim: row.data_fim ?? null,
  };
}

export function mergeIdentidadeSugestaoJob(current, sugestao) {
  const out = normalizeIdentidadeDados(current || {});
  const inc = normalizeIdentidadeDados(sugestao || {});

  for (const key of TEXT_KEYS) {
    const next = String(inc[key] ?? "").trim();
    const cur = String(out[key] ?? "").trim();
    if (!cur && next) out[key] = next;
  }

  const palette = mergeIdentidadePaletteFields(out, inc);
  out.cor_primaria = palette.cor_primaria;
  out.cor_secundaria = palette.cor_secundaria;
  out.cores_adicionais = palette.cores_adicionais;

  if (!out.id_midia_referencia_analise && inc.id_midia_referencia_analise) {
    out.id_midia_referencia_analise = inc.id_midia_referencia_analise;
  }
  if (!out.id_midia_logo && inc.id_midia_logo) {
    out.id_midia_logo = inc.id_midia_logo;
  }
  return normalizeIdentidadeDados(out);
}

async function updateJobRow(supabase, idJob, patch) {
  const payload = {
    ...patch,
    data_atualizacao: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("identidade_analise_job")
    .update(payload)
    .eq("id_identidade_analise_job", idJob)
    .select(JOB_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function loadMidiasByIds(supabase, idEmpresa, ids) {
  const clean = [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!clean.length) return [];
  const { data, error } = await supabase
    .from("midia")
    .select("id_midia, nome_exibicao, nome_arquivo, url_arquivo, id_empresa, ativo")
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .in("id_midia", clean);
  if (error) throw new Error(error.message);
  const byId = new Map((Array.isArray(data) ? data : []).map((row) => [String(row.id_midia ?? "").trim(), row]));
  return clean.map((id) => byId.get(id)).filter(Boolean);
}

function buildInitialProgress(rows, incluiSite) {
  return {
    fotoTotal: rows.length,
    fotoConcluidas: 0,
    fotoAtual: 0,
    fase: "foto",
    incluiSite,
    items: rows.map((row) => ({
      id_midia: String(row.id_midia ?? "").trim(),
      nome: String(row.nome_exibicao ?? row.nome_arquivo ?? "Imagem").trim() || "Imagem",
      preview_url: String(row.url_arquivo ?? "").trim() || null,
      status: "pending",
      error: null,
    })),
  };
}

async function fetchEmpresaAnaliseBase(supabase, idEmpresa) {
  const { data, error } = await supabase
    .from("empresa")
    .select("nome_fantasia, descricao, segmento, site_empresa")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data && typeof data === "object" ? data : null;
}

async function processIdentidadeAnaliseJob(supabase, row) {
  const serialized = serializeIdentidadeAnaliseJobRow(row);
  const idJob = serialized?.id_job;
  if (!idJob || runningJobs.has(idJob)) return;
  runningJobs.add(idJob);

  try {
    let currentRow = await updateJobRow(supabase, idJob, {
      status: "running",
      data_inicio: row.data_inicio || new Date().toISOString(),
    });
    const payload = currentRow.payload_json && typeof currentRow.payload_json === "object" ? currentRow.payload_json : {};
    const progress = normalizeProgress(currentRow.progresso_json);
    const empresaRow = await fetchEmpresaAnaliseBase(supabase, currentRow.id_empresa);
    let merged = normalizeIdentidadeDados(currentRow.dados_base_json || {});
    let okCount = 0;
    let firstError = null;

    for (let i = 0; i < progress.items.length; i++) {
      const item = progress.items[i];
      progress.fase = "foto";
      progress.fotoAtual = i + 1;
      progress.items[i] = { ...item, status: "analyzing", error: null };
      currentRow = await updateJobRow(supabase, idJob, { progresso_json: progress });

      try {
        const out = await analisarIdentidadeMarca(
          supabase,
          currentRow.id_empresa,
          { id_midia: item.id_midia },
          empresaRow,
        );
        merged = mergeIdentidadeSugestaoJob(merged, out?.sugestao || {});
        okCount += 1;
        progress.items[i] = { ...progress.items[i], status: "done", error: null };
        progress.fotoConcluidas = okCount;
        currentRow = await updateJobRow(supabase, idJob, {
          progresso_json: progress,
          dados_resultado_json: merged,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao analisar foto.";
        if (!firstError) firstError = msg;
        progress.items[i] = { ...progress.items[i], status: "error", error: msg };
        currentRow = await updateJobRow(supabase, idJob, {
          progresso_json: progress,
        });
      }
    }

    const incluiSite = payload.inclui_site === true;
    const siteUrl = typeof payload.site_url === "string" ? payload.site_url.trim() : "";
    if (incluiSite && okCount > 0) {
      progress.fase = "site";
      progress.fotoAtual = progress.fotoTotal;
      currentRow = await updateJobRow(supabase, idJob, { progresso_json: progress });
      try {
        const out = await analisarIdentidadeMarca(
          supabase,
          currentRow.id_empresa,
          siteUrl ? { site_url: siteUrl } : {},
          empresaRow,
        );
        merged = mergeIdentidadeSugestaoJob(merged, out?.sugestao || {});
        currentRow = await updateJobRow(supabase, idJob, {
          dados_resultado_json: merged,
          progresso_json: progress,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao analisar site.";
        if (!firstError) firstError = msg;
      }
    }

    await updateJobRow(supabase, idJob, {
      status: okCount > 0 ? "completed" : "failed",
      erro: okCount > 0 ? null : firstError || "Nenhuma foto foi analisada com sucesso.",
      progresso_json: progress,
      dados_resultado_json: okCount > 0 ? merged : currentRow.dados_resultado_json,
      data_fim: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao processar job de identidade.";
    try {
      await updateJobRow(supabase, row.id_identidade_analise_job, {
        status: "failed",
        erro: msg,
        data_fim: new Date().toISOString(),
      });
    } catch (updateErr) {
      console.error("identidadeAnaliseJob.updateFailure:", updateErr);
    }
  } finally {
    runningJobs.delete(String(row.id_identidade_analise_job ?? "").trim());
  }
}

export async function findLatestIdentidadeAnaliseJob(supabase, idEmpresa) {
  const { data, error } = await supabase
    .from("identidade_analise_job")
    .select(JOB_SELECT)
    .eq("id_empresa", idEmpresa)
    .order("data_criacao", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return serializeIdentidadeAnaliseJobRow(data);
}

export async function findActiveIdentidadeAnaliseJob(supabase, idEmpresa) {
  const { data, error } = await supabase
    .from("identidade_analise_job")
    .select(JOB_SELECT)
    .eq("id_empresa", idEmpresa)
    .in("status", ["queued", "running"])
    .order("data_criacao", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createIdentidadeAnaliseJob(supabase, idEmpresa, idUsuario, rawBody) {
  const parsed = jobCreateBody.safeParse(rawBody ?? {});
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.flatten() };
  }

  const existing = await findActiveIdentidadeAnaliseJob(supabase, idEmpresa);
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: "Já existe uma análise de identidade em andamento para esta empresa.",
      job: serializeIdentidadeAnaliseJobRow(existing),
    };
  }

  const rows = await loadMidiasByIds(supabase, idEmpresa, parsed.data.midia_ids);
  if (!rows.length) {
    return { ok: false, status: 400, error: "Nenhuma mídia válida foi enviada para análise." };
  }
  if (rows.length !== parsed.data.midia_ids.length) {
    return { ok: false, status: 400, error: "Uma ou mais fotos de análise não existem ou não pertencem a esta empresa." };
  }

  const dadosBase = normalizeIdentidadeDados(parsed.data.dados_base || {});
  const progresso = buildInitialProgress(rows, parsed.data.inclui_site === true);
  const payloadJson = {
    midia_ids: rows.map((row) => String(row.id_midia ?? "").trim()),
    inclui_site: parsed.data.inclui_site === true,
    site_url: parsed.data.site_url ? String(parsed.data.site_url).trim() : "",
  };

  const { data, error } = await supabase
    .from("identidade_analise_job")
    .insert({
      id_empresa: idEmpresa,
      criado_por_usuario_id: idUsuario,
      status: "queued",
      payload_json: payloadJson,
      progresso_json: progresso,
      dados_base_json: dadosBase,
      dados_resultado_json: null,
      erro: null,
    })
    .select(JOB_SELECT)
    .single();
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  setTimeout(() => {
    void processIdentidadeAnaliseJob(supabase, data);
  }, 0);

  return { ok: true, status: 201, job: serializeIdentidadeAnaliseJobRow(data) };
}
