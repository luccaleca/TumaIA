import { resolveFraseNaImagem } from "./imageHeadline.js";
import {
  formatBrandIdentityBlockForFlux,
  partitionContextosIdentidade,
} from "../modules/empresas/identidadeMarca.js";

/** Limite do schema FLUX Schnell (`fluxSchnellInputSchema.prompt`). */
export const FLUX_IMAGE_PROMPT_MAX = 2000;

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function loadContextosEmpresaAtivos(db, idEmpresa) {
  const { data, error } = await db
    .from("contexto_empresa")
    .select("id_contexto_empresa, nome, descricao, schema_json, dados_json, data_criacao")
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .order("data_criacao", { ascending: false })
    .limit(24);
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function loadEmpresaResumoParaImagem(db, idEmpresa) {
  const { data, error } = await db
    .from("empresa")
    .select("id_empresa, nome_fantasia, descricao, segmento, instagram_empresa")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data && typeof data === "object" ? data : null;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {number} [limit]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function loadMidiasEmpresaResumo(db, idEmpresa, limit = 48) {
  const { data, error } = await db
    .from("midia")
    .select(
      "id_midia, nome_exibicao, nome_arquivo, descricao, alt_text, tipo_midia, formato_arquivo, data_criacao",
    )
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .order("data_criacao", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

function compactJson(value, maxLen) {
  try {
    const s = JSON.stringify(value ?? null);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen - 1)}…`;
  } catch {
    return "";
  }
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {number} budgetChars
 */
function formatContextosBlock(rows, budgetChars) {
  if (!rows.length || budgetChars < 80) return "";
  const lines = [];
  let used = 0;
  const per = Math.max(120, Math.floor(budgetChars / Math.min(rows.length, 8)));
  for (const row of rows.slice(0, 12)) {
    const nome = String(row.nome ?? "").trim() || "(sem nome)";
    const desc = String(row.descricao ?? "").trim();
    const dados = compactJson(row.dados_json, Math.min(420, per));
    const schema = compactJson(row.schema_json, 120);
    let chunk = `- ${nome}`;
    if (desc) chunk += `\n  descrição: ${desc.slice(0, 280)}${desc.length > 280 ? "…" : ""}`;
    if (dados && dados !== "null") chunk += `\n  dados: ${dados}`;
    if (schema && schema !== "null" && schema !== "{}") chunk += `\n  schema: ${schema}`;
    chunk += "\n";
    if (used + chunk.length > budgetChars) break;
    lines.push(chunk);
    used += chunk.length;
  }
  if (!lines.length) return "";
  return lines.join("\n");
}

/**
 * @param {Record<string, unknown> | null} emp
 * @param {number} maxLen
 */
function formatEmpresaBlock(emp, maxLen) {
  if (!emp) return "";
  const parts = [];
  const nf = String(emp.nome_fantasia ?? "").trim();
  if (nf) parts.push(`nome: ${nf}`);
  const seg = String(emp.segmento ?? "").trim();
  if (seg) parts.push(`segmento: ${seg}`);
  const ig = String(emp.instagram_empresa ?? "").trim();
  if (ig) parts.push(`instagram: ${ig}`);
  const desc = String(emp.descricao ?? "").trim();
  if (desc) parts.push(`sobre: ${desc.slice(0, 500)}${desc.length > 500 ? "…" : ""}`);
  let s = parts.join("\n");
  if (s.length > maxLen) s = s.slice(0, maxLen - 1) + "…";
  return s;
}

function formatConversationBlock(history, maxLen) {
  const tail = history.slice(-8);
  const block = tail
    .map((m) => {
      const cap = m.role === "user" ? 220 : 120;
      return `${m.role === "user" ? "Cliente" : "Assistente"}: ${String(m.content).slice(0, cap)}`;
    })
    .join("\n");
  if (block.length <= maxLen) return block;
  return "…" + block.slice(block.length - maxLen + 1);
}

function introWithFrase(frase, hasReferenceImage, referenceKind = "product") {
  const textRule = frase
    ? `The ONLY text in the image must be exactly this Portuguese phrase (large, readable, one line, correct spelling): "${frase}". No other words, no repeated text, no extra paragraphs.`
    : "Minimal or no text in the image.";
  if (hasReferenceImage) {
    const refRule =
      referenceKind === "logo"
        ? "The reference image is the brand LOGO only: place a SMALL logo mark in one corner (about 8–12% of the frame height), never centered, never full-bleed, never enlarged to fill the canvas. Build a new scene around it (product, promo background)."
        : "The reference image is a PRODUCT packshot to feature as the hero (center or rule-of-thirds) — NOT an old post or banner to copy. Do NOT replicate the reference layout.";
    return (
      `Create a NEW Instagram key visual. ${refRule} ` +
      textRule +
      " Fresh marketing composition aligned with the brand brief."
    );
  }
  return (
    "Professional marketing key visual for Instagram (square). Clean, high quality. " +
    textRule +
    " No watermarks, no gibberish."
  );
}

/**
 * Monta o prompt final respeitando `FLUX_IMAGE_PROMPT_MAX`, priorizando intro + empresa + contextos e truncando a conversa por último.
 *
 * @param {{
 *   history: Array<{ role: string, content: string }>,
 *   empresaRow: Record<string, unknown> | null,
 *   contextoRows: Array<Record<string, unknown>>,
 *   postContextProposal?: Record<string, unknown> | null,
 *   focusCampanhaContextoId?: string | null,
 *   referenceKind?: 'logo' | 'product' | null,
 * }} p
 */
export function buildFluxImagePrompt({
  history,
  empresaRow,
  contextoRows,
  postContextProposal,
  hasReferenceImage = false,
  focusCampanhaContextoId = null,
  referenceKind = null,
}) {
  const intent =
    postContextProposal && typeof postContextProposal === "object"
      ? String(postContextProposal.intent_summary ?? "").trim().slice(0, 200)
      : "";
  const fraseNaImagem = resolveFraseNaImagem(postContextProposal, history, contextoRows);
  const proposalSection = [
    intent ? `Resumo do pedido: ${intent}` : "",
    fraseNaImagem ? `Frase obrigatória na imagem (tipografia legível): "${fraseNaImagem}"` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const proposalBlock = proposalSection
    ? `\n\n=== Brief visual ===\n${proposalSection}`
    : "";

  const { identidadeDados, campanhaRows } = partitionContextosIdentidade(contextoRows);
  const focusId = focusCampanhaContextoId ? String(focusCampanhaContextoId).trim() : "";
  const campanhaForPrompt =
    focusId && campanhaRows.length
      ? (() => {
          const picked = campanhaRows.filter(
            (r) => String(r.id_contexto_empresa ?? "").trim() === focusId,
          );
          return picked.length ? picked : campanhaRows;
        })()
      : campanhaRows;
  const brandBlock = identidadeDados
    ? formatBrandIdentityBlockForFlux(identidadeDados, 480)
    : "";

  const empBlock = formatEmpresaBlock(empresaRow, 280);
  const kind = referenceKind === "logo" ? "logo" : "product";
  const intro = introWithFrase(fraseNaImagem, hasReferenceImage, hasReferenceImage ? kind : "product");
  const logoCornerHint = identidadeDados?.id_midia_logo
    ? referenceKind === "logo"
      ? "\n\nBrand logo is the HERO element (client requested); still avoid illegible stretching."
      : "\n\nBrand logo: ALWAYS a small mark in a corner (bottom-right or top-left, ~8–12% of frame). Never centered, never full-bleed, unless the brief explicitly says logo as hero."
    : "";
  const overhead =
    intro.length +
    logoCornerHint.length +
    proposalBlock.length +
    (brandBlock ? brandBlock.length + 48 : 0) +
    (empBlock ? empBlock.length + 40 : 0) +
    80;
  const ctxBudget = Math.min(520, Math.max(160, FLUX_IMAGE_PROMPT_MAX - overhead));
  const ctxBlock = formatContextosBlock(campanhaForPrompt, ctxBudget);

  const headerParts = [intro];
  if (logoCornerHint) headerParts.push(logoCornerHint);
  if (brandBlock) headerParts.push(`\n\n=== Brand identity ===\n${brandBlock}`);
  if (proposalBlock) headerParts.push(proposalBlock);
  if (empBlock) headerParts.push(`\n\n=== Empresa (cadastro) ===\n${empBlock}`);
  if (ctxBlock) headerParts.push(`\n\n=== Contextos de campanha ===\n${ctxBlock}`);
  const header = headerParts.join("");

  const reserved = header.length + 20;
  let convBudget = Math.max(200, FLUX_IMAGE_PROMPT_MAX - reserved);
  let conv = formatConversationBlock(history, convBudget);
  let full = `${header}\n\n=== Conversa recente ===\n${conv}`;

  while (full.length > FLUX_IMAGE_PROMPT_MAX && convBudget > 120) {
    convBudget -= 150;
    conv = formatConversationBlock(history, convBudget);
    full = `${header}\n\n=== Conversa recente ===\n${conv}`;
  }

  if (full.length > FLUX_IMAGE_PROMPT_MAX) {
    full = full.slice(0, FLUX_IMAGE_PROMPT_MAX - 1) + "…";
  }

  return full;
}

/**
 * Metadados seguros para o cliente validar o primeiro fluxo (sem prompt inteiro).
 *
 * @param {string} idEmpresa
 * @param {Record<string, unknown> | null} empresaRow
 * @param {Array<Record<string, unknown>>} contextoRows
 */
export function buildImagePreviewContextMeta(
  idEmpresa,
  empresaRow,
  contextoRows,
  postContextProposal,
  history,
  focusCampanhaContextoId = null,
) {
  const frase_na_imagem = resolveFraseNaImagem(postContextProposal, history || [], contextoRows);
  const { identidadeDados, campanhaRows } = partitionContextosIdentidade(contextoRows);
  const focusId = focusCampanhaContextoId ? String(focusCampanhaContextoId).trim() : "";
  const campanhaMeta =
    focusId && campanhaRows.length
      ? (() => {
          const picked = campanhaRows.filter(
            (r) => String(r.id_contexto_empresa ?? "").trim() === focusId,
          );
          return picked.length ? picked : campanhaRows;
        })()
      : campanhaRows;
  return {
    id_empresa: idEmpresa,
    empresa_nome_fantasia: empresaRow ? String(empresaRow.nome_fantasia ?? "").trim() || null : null,
    frase_na_imagem,
    identidade_configurada: Boolean(
      identidadeDados?.cor_primaria || identidadeDados?.estilo_visual || identidadeDados?.id_midia_logo,
    ),
    contextos_carregados: campanhaMeta.length,
    contextos: campanhaMeta.map((r) => ({
      id_contexto_empresa: r.id_contexto_empresa ?? null,
      nome: String(r.nome ?? "").trim() || null,
      descricao_preview: (() => {
        const d = String(r.descricao ?? "").trim();
        if (!d) return null;
        return d.length > 220 ? `${d.slice(0, 220)}…` : d;
      })(),
      dados_preview: (() => {
        const raw = compactJson(r.dados_json, 320);
        return raw.length > 320 ? `${raw.slice(0, 319)}…` : raw;
      })(),
    })),
  };
}
