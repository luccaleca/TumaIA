/**
 * Respostas de produto a partir de mídias reais (Supabase).
 */

import { loadMidiasEmpresaResumo } from "./imagePreviewPrompt.js";
import { classifyChatAcervoIntent } from "./chatIntent.js";
import {
  buildMidiaSearchBlob,
  rowMatchesProductSpec,
  scorePhraseAgainstBlob,
} from "./productMentionMatch.js";

const MIDIA_MATCH_MIN_SCORE = 35;

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i;

/**
 * @param {string} name
 */
function stripImageExtension(name) {
  return String(name || "")
    .trim()
    .replace(IMAGE_EXT_RE, "")
    .trim();
}

/**
 * @param {string} raw
 */
function exibicaoPareceNomeDeArquivo(raw) {
  const s = String(raw || "").trim();
  if (!s) return false;
  if (IMAGE_EXT_RE.test(s)) return true;
  if (/^\d{6,}[-_]/.test(s)) return true;
  if (/[-_]/.test(s) && !/\s/.test(s)) return true;
  return false;
}

/**
 * @param {string} base
 */
function humanizeProductSlug(base) {
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * @param {Record<string, unknown>} row
 */
export function midiaProductLabel(row) {
  const exibRaw = String(row?.nome_exibicao ?? "").trim();
  const arquivoRaw = String(row?.nome_arquivo ?? "").trim();

  if (exibRaw) {
    const base = stripImageExtension(exibRaw);
    if (exibicaoPareceNomeDeArquivo(exibRaw)) {
      return humanizeProductSlug(base) || "Produto";
    }
    return base || "Produto";
  }

  if (arquivoRaw) {
    return humanizeProductSlug(stripImageExtension(arquivoRaw)) || "Produto";
  }

  return "Produto";
}

/**
 * @param {string[]} names
 */
export function formatProductNamesPt(names) {
  const list = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} e ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}`;
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} termo
 */
export function midiaRowMatchesTerm(row, termo) {
  const term = String(termo || "").trim();
  if (!term || term.length < 2) return false;

  const score = scorePhraseAgainstBlob(buildMidiaSearchBlob(row), term);
  if (score >= MIDIA_MATCH_MIN_SCORE) return true;

  const blob = buildMidiaSearchBlob(row)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const norm = term
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const tokens = norm.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  if (!tokens.length) return blob.includes(norm);
  return tokens.every((tok) => blob.includes(tok));
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function imagensAcervo(rows) {
  return (rows || []).filter((r) => String(r?.tipo_midia ?? "").trim().toLowerCase() === "imagem");
}

/**
 * Rótulos de teste/upload bruto — não listar no chat salvo se houver alternativa.
 * @param {string} label
 */
export function isArtifactProductLabel(label) {
  const s = String(label || "").trim();
  if (!s) return true;
  if (/^\d{10,}[\s_-]/.test(s)) return true;
  if (/^teste\d*$/i.test(s)) return true;
  if (/foto\s+teste/i.test(s)) return true;
  if (/logo\s+no\s+background/i.test(s)) return true;
  return false;
}

/**
 * @param {string[]} labels
 */
export function filterDisplayProductLabels(labels) {
  const list = (labels || []).map((l) => String(l).trim()).filter(Boolean);
  const clean = list.filter((l) => !isArtifactProductLabel(l));
  return clean.length ? clean : list;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {import("./productMentionMatch.js").ReturnType<typeof import("./productMentionMatch.js").parseProductMentionSpec> | null} [filtro]
 */
function filterRowsForList(rows, filtro) {
  const imgs = imagensAcervo(rows);
  if (!filtro || filtro.mode === "none") return imgs;
  const minScore = 28;
  const hits = imgs.filter((r) => rowMatchesProductSpec(r, filtro, minScore));
  return hits;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string | null} nomeFantasia
 * @param {string | null} [rotuloFiltro]
 * @param {import("./productMentionMatch.js").ReturnType<typeof import("./productMentionMatch.js").parseProductMentionSpec> | null} [filtro]
 */
function formatListAnswer(rows, nomeFantasia, rotuloFiltro = null, filtro = null) {
  const marca = nomeFantasia ? ` da ${nomeFantasia}` : "";
  const imgs = filterRowsForList(rows, filtro);
  const rotulo = String(rotuloFiltro || "").trim();

  if (rotulo && !imgs.length) {
    return (
      `Não encontrei produtos de «${rotulo}» em Mídias${marca}. ` +
      "Confira o nome no painel ou cadastre a foto com esse nome."
    );
  }

  if (!imgs.length) {
    return (
      `Ainda não encontrei produtos com foto em Mídias${marca}. ` +
      "Cadastre as imagens no painel com nomes claros — aí consigo listar e usar nos posts."
    );
  }

  const rawLabels = [...new Set(imgs.map(midiaProductLabel))];
  const labels = filterDisplayProductLabels(rawLabels).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const bullets = labels.map((l) => `• ${l}`).join("\n");
  const skipped = rawLabels.length - labels.length;
  const nota =
    skipped > 0
      ? `\n\n(${skipped} ${skipped === 1 ? "item de teste oculto" : "itens de teste ocultos"} — renomeie em Mídias se quiser exibir.)`
      : "";
  const intro = rotulo
    ? `No acervo${marca}, relacionados a «${rotulo}», temos ${labels.length} ${labels.length === 1 ? "produto" : "produtos"}:`
    : `No acervo${marca} temos ${labels.length} ${labels.length === 1 ? "produto" : "produtos"}:`;
  return `${intro}\n\n${bullets}${nota}\n\nQuer montar post de algum deles?`;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string | null} termo
 * @param {string | null} nomeFantasia
 */
function formatInfoAnswer(rows, termo, nomeFantasia) {
  const marca = nomeFantasia ? ` da ${nomeFantasia}` : "";
  const imgs = imagensAcervo(rows);

  if (!termo) {
    const n = imgs.length;
    if (!n) {
      return `Ainda não há produtos com foto cadastrados em Mídias${marca}.`;
    }
    return `Temos ${n} ${n === 1 ? "produto com foto" : "produtos com foto"} em Mídias${marca}.`;
  }

  const hits = imgs.filter((r) => midiaRowMatchesTerm(r, termo));
  if (!hits.length) {
    return (
      `Não encontrei «${termo}» cadastrado em Mídias${marca}. ` +
      "Se for produto novo, cadastre a imagem no painel com esse nome."
    );
  }

  const names = [...new Set(hits.map(midiaProductLabel))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const lista = formatProductNamesPt(names);

  if (names.length === 1) {
    return `Sim — temos ${lista}${marca ? ` no acervo${marca}` : ""}.`;
  }

  return `Sim — temos ${lista}${marca ? ` no acervo${marca}` : ""}.`;
}

/**
 * @param {{
 *   question: string,
 *   history?: Array<{ role: string, content: string }>,
 *   idEmpresa: string,
 *   db: import("@supabase/supabase-js").SupabaseClient,
 *   nomeFantasia?: string | null,
 *   midias?: Array<Record<string, unknown>>,
 *   classifyIntent?: typeof classifyChatAcervoIntent,
 * }} opts
 * @returns {Promise<string | null>}
 */
export async function tryChatAcervoResponse(opts) {
  const { question, idEmpresa, db } = opts;
  const midiasInline = Array.isArray(opts.midias) && opts.midias.length > 0;
  if (!idEmpresa || (!db && !midiasInline)) return null;

  let nomeFantasia = opts.nomeFantasia != null ? String(opts.nomeFantasia).trim() : "";
  if (!nomeFantasia && db) {
    const { data: emp } = await db
      .from("empresa")
      .select("nome_fantasia")
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true)
      .maybeSingle();
    nomeFantasia = String(emp?.nome_fantasia ?? "").trim();
  }

  const midias = midiasInline
    ? opts.midias
    : await loadMidiasEmpresaResumo(db, idEmpresa, 200);

  const classify = opts.classifyIntent || classifyChatAcervoIntent;
  const { kind, termo, filtro } = classify(question, opts.history || []);

  if (kind === "NONE") return null;

  if (kind === "LISTAR_PRODUTOS") {
    return formatListAnswer(midias, nomeFantasia || null, termo, filtro ?? null);
  }

  if (kind === "INFO_PRODUTO") {
    return formatInfoAnswer(midias, termo, nomeFantasia || null);
  }

  return null;
}
