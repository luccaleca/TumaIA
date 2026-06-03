/**
 * Acervo no prompt do LLM e bloqueio de produtos inventados na resposta.
 */

import { extractProductMentions } from "./productMentionMatch.js";
import { formatProductNamesPt, midiaProductLabel, filterDisplayProductLabels } from "./chatAcervoResponse.js";
import { loadMidiasEmpresaResumo } from "./imagePreviewPrompt.js";
import { shouldSkipProductGuard } from "./chatOffTopic.js";

const AVAILABILITY_LANG =
  /\b(temos|t[eê]m|dispon[ií]ve|cadastrad|acervo|cat[aá]logo|vendemos|oferecemos|linha\s+de|produtos?\s+incluem|nossos?\s+produtos?)\b/i;

const META_LIST_QUESTION =
  /\b(gostaria\s+de\s+saber|quer\s+que\s+eu\s+liste|posso\s+listar|devo\s+listar|quer\s+ver\s+a\s+lista)\b/i;

const FILE_EXT = /\b[\w-]+\.(png|jpg|jpeg|webp)\b/gi;

const CATALOG_META = new Set([
  "acervo",
  "catalogo",
  "midia",
  "midias",
  "produto",
  "produtos",
  "loja",
  "empresa",
  "item",
  "itens",
  "foto",
  "fotos",
  "imagem",
  "imagens",
  "cadastrado",
  "cadastrada",
  "disponivel",
]);

/**
 * @param {string} term
 */
function isCatalogMetaTerm(term) {
  const t = String(term || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return CATALOG_META.has(t);
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function acervoProductLabels(rows) {
  const raw = [
    ...new Set(
      (rows || [])
        .filter((r) => String(r?.tipo_midia ?? "").trim().toLowerCase() === "imagem")
        .map(midiaProductLabel)
        .filter(Boolean),
    ),
  ];
  return filterDisplayProductLabels(raw).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * @param {string[]} labels
 * @param {string | null} nomeFantasia
 */
export function buildAcervoPromptBlock(labels, nomeFantasia = null) {
  const marca = nomeFantasia ? ` da ${nomeFantasia}` : "";
  if (!labels.length) {
    return (
      `[ACERVO DE PRODUTOS — Mídias${marca}]\n` +
      "Nenhum produto com foto cadastrado. Não invente nomes de produto, preço nem SKU. " +
      "Se perguntarem o que temos, diga que ainda falta cadastrar imagens no painel (Mídias)."
    );
  }

  const bullets = labels.map((l) => `- ${l}`).join("\n");
  return (
    `[ACERVO DE PRODUTOS — fonte de verdade${marca}]\n` +
    "Disponível = imagem cadastrada em Mídias. Só cite estes nomes (nunca extensão .png):\n" +
    `${bullets}\n` +
    "Se pedirem lista ou «temos X?», responda direto com estes nomes — não pergunte se quer listar. " +
    "Não cite categorias genéricas (ex.: suplementos de musculação) nem produtos fora desta lista."
  );
}

/**
 * @param {string} answer
 * @param {Array<Record<string, unknown>>} imageRows
 * @param {string | null} nomeFantasia
 * @param {{ userQuestion?: string }} [opts]
 */
export function guardChatProductAnswer(answer, imageRows, nomeFantasia = null, opts = {}) {
  let text = String(answer || "").trim();
  if (!text) return text;

  const q = String(opts.userQuestion || "");
  if (q && shouldSkipProductGuard(q)) {
    return text;
  }

  text = text.replace(FILE_EXT, (m) => m.replace(/\.[^.]+$/i, "").replace(/[-_]+/g, " "));

  const labels = acervoProductLabels(imageRows);
  const marca = nomeFantasia ? ` da ${nomeFantasia}` : "";

  if (META_LIST_QUESTION.test(text) && q && /\b(lista|produtos?|acervo|cat[aá]logo|quais|enumera)\b/i.test(q)) {
    if (!labels.length) {
      return `Ainda não encontrei produtos com foto em Mídias${marca}. Cadastre as imagens no painel com nomes claros.`;
    }
    const bullets = labels.map((l) => `• ${l}`).join("\n");
    return `No acervo${marca} temos ${labels.length} ${labels.length === 1 ? "produto" : "produtos"}:\n\n${bullets}`;
  }

  const mentions = extractProductMentions(text);
  const talksProducts = AVAILABILITY_LANG.test(text) || mentions.length > 0;

  if (talksProducts && labels.length && /\b(suplementos?|muscula[cç][aã]o|hidrata[cç][aã]o|recupera[cç][aã]o)\b/i.test(text)) {
    const bullets = labels.map((l) => `• ${l}`).join("\n");
    return (
      `No acervo${marca} temos ${labels.length} ${labels.length === 1 ? "produto" : "produtos"}:\n\n` +
      `${bullets}\n\n` +
      "Quer montar post de algum deles?"
    );
  }

  if (!labels.length) {
    if (talksProducts) {
      return (
        `Ainda não temos produtos com foto em Mídias${marca}. ` +
        "Cadastre as imagens no painel — aí consigo listar e usar nos posts."
      );
    }
    return text;
  }

  for (const mention of mentions) {
    if (isCatalogMetaTerm(mention)) continue;
    const blobMatch = imageRows.some((row) => {
      const blob = [
        row?.nome_exibicao,
        row?.nome_arquivo,
        row?.descricao,
        row?.alt_text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(String(mention).toLowerCase());
    });
    if (!blobMatch && AVAILABILITY_LANG.test(text)) {
      const sample = labels.slice(0, 6);
      return (
        `Não encontrei «${mention}» cadastrado em Mídias${marca}. ` +
        `No acervo temos ${formatProductNamesPt(sample)}${labels.length > sample.length ? " e outros" : ""}.`
      );
    }
  }

  return text;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 */
export async function loadChatAcervoBundle(db, idEmpresa) {
  const { data: emp } = await db
    .from("empresa")
    .select("nome_fantasia")
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .maybeSingle();

  const nomeFantasia = String(emp?.nome_fantasia ?? "").trim() || null;
  const midias = await loadMidiasEmpresaResumo(db, idEmpresa, 200);
  const labels = acervoProductLabels(midias);

  return {
    midias,
    labels,
    nomeFantasia,
    promptBlock: buildAcervoPromptBlock(labels, nomeFantasia),
  };
}
