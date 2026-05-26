import { env } from "../config.js";
import { filterMidiasAcervo } from "../modules/empresas/midiaOrigem.js";
import { resolveFraseNaImagem, resolvePedidoCliente } from "./imageHeadline.js";
import { aspectRatioFromArteBrief, promptFromArteBrief } from "./rawImageArteBrief.js";
import {
  formatBrandIdentityBlockForFlux,
  formatBrandIdentityCompact,
  formatBrandIdentityForRawPrompt,
  partitionContextosIdentidade,
} from "../modules/empresas/identidadeMarca.js";

/** Limite legado FLUX. */
export const FLUX_IMAGE_PROMPT_MAX = 2000;

export const FLUX_IMAGE_PROMPT_COMPACT_TARGET = 520;

/**
 * Prompt para GPT Image 2 (pipeline raw): pedido do cliente + identidade da marca.
 *
 * @param {Array<{ role: string, content: string }>} history
 * @param {Record<string, unknown> | null | undefined} postContextProposal
 * @param {Record<string, unknown> | null | undefined} identidadeDados
 * @param {{ strictProductReference?: boolean, composeProductAssets?: boolean, productCount?: number }} [opts]
 */
export function buildRawImagePrompt(history, postContextProposal, identidadeDados = null, opts = {}) {
  const proposal =
    postContextProposal && typeof postContextProposal === "object" ? postContextProposal : null;
  const arteBrief = proposal?.arte_brief;
  let base = "";
  if (arteBrief && typeof arteBrief === "object") {
    const fromBrief = promptFromArteBrief(/** @type {Record<string, unknown>} */ (arteBrief));
    if (fromBrief.trim()) base = fromBrief;
  }
  if (!base) {
    const pedido = resolvePedidoCliente(postContextProposal, history, 32_000);
    if (pedido) base = pedido;
  }
  if (!base) {
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      if (m?.role === "user") {
        const t = String(m.content ?? "").trim();
        if (t) {
          base = t;
          break;
        }
      }
    }
  }
  if (!base) base = "Instagram marketing image";

  const composeProductAssets = opts?.composeProductAssets === true;
  const strictProductReference = opts?.strictProductReference === true && !composeProductAssets;
  if (strictProductReference) {
    base = `${base}\n\nProduto do acervo em referência: preservar RIGOROSAMENTE o design real da embalagem e do rótulo do produto mostrado em input_images. Manter formato do pote/embalagem, tampa, proporções, cores, sabor/variante, marca, posição dos elementos e aparência geral. NÃO redesenhar, NÃO inventar novo rótulo, NÃO trocar a marca e NÃO simplificar a embalagem. Pode mudar apenas cenário, iluminação, enquadramento e composição da campanha.`;
  }
  const productCount = Math.max(1, Math.min(3, Number(opts?.productCount) || 1));
  if (composeProductAssets) {
    base = `${base}\n\nEsta geração deve criar SOMENTE o fundo/cenário/layout da campanha. Não renderize nenhum pote, embalagem, rótulo, sache, caixa ou produto fictício. Reserve uma área hero limpa no primeiro plano para inserção posterior de ${productCount} produto${productCount > 1 ? "s reais" : " real"} do acervo. Pode incluir luz, pedestal, cenário, props e atmosfera promocional, mas sem desenhar o produto.`;
  }

  const brand = identidadeDados ? formatBrandIdentityForRawPrompt(identidadeDados) : "";
  if (brand) {
    return `${base}\n\nIdentidade da marca (alinhar visual e cores):\n${brand}`.slice(0, 32_000);
  }
  return base.slice(0, 32_000);
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
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

export async function loadEmpresaResumoParaImagem(db, idEmpresa) {
  const { data, error } = await db
    .from("empresa")
    .select("id_empresa, nome_fantasia, descricao, segmento, instagram_empresa")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data && typeof data === "object" ? data : null;
}

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
  return filterMidiasAcervo(Array.isArray(data) ? data : []);
}

function compressPedidoVisual(pedido, maxLen = 240) {
  let s = String(pedido ?? "")
    .replace(/frase\s*:\s*.+?(?=\s*[,;]|$)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 1)}…`;
  return s;
}

function formatPedidoBlock(pedido, frase, maxLen) {
  const lines = [];
  const p = String(pedido ?? "").trim();
  if (p) lines.push(p);
  if (frase) {
    const needle = frase.toLowerCase().slice(0, Math.min(24, frase.length));
    if (!p || !p.toLowerCase().includes(needle)) {
      lines.push(`Frase na imagem: «${frase}»`);
    }
  }
  if (!lines.length) return "";
  let s = lines.join("\n");
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 1)}…`;
  return s;
}

function introWithFrase(frase, hasReferenceImage, referenceKind = "product") {
  const textRule = frase
    ? `The ONLY text in the image must be exactly this Portuguese phrase (large, readable, one line, correct spelling): "${frase}". No other words, no repeated text, no extra paragraphs.`
    : "Minimal or no text in the image.";
  if (hasReferenceImage) {
    const refRule =
      referenceKind === "logo"
        ? "The reference image is the brand LOGO only: place a SMALL logo mark in one corner (about 8–12% of the frame height), never centered, never full-bleed, never enlarged to fill the canvas. Build a new scene around it (product, promo background)."
        : "The reference image is a PRODUCT packshot to feature as the hero (center or rule-of-thirds) — NOT an old post or banner to copy. Preserve the EXACT package design, label, colors, proportions and brand details of the referenced product. Do NOT redesign the packaging or invent a different label.";
    return (
      `Create a NEW Instagram key visual. ${refRule} ` +
      textRule +
      " Follow the Client request and Brand identity sections only."
    );
  }
  return (
    "Professional marketing key visual for Instagram (square). Clean, high quality. " +
    textRule +
    " Follow the Client request and Brand identity sections only. No watermarks, no gibberish."
  );
}

function buildCompactImagePrompt({
  pedido,
  frase,
  brandCompact,
  hasReferenceImage,
  referenceKind,
  logoConfigured,
  logoAsHero,
}) {
  const chunks = ["Square 1:1 Instagram ad, premium, clean, high quality."];

  if (hasReferenceImage) {
    chunks.push(
      referenceKind === "logo"
        ? "Use reference as small corner logo only."
        : "Hero product from reference image, new layout, preserve exact package design and label.",
    );
  } else if (logoConfigured) {
    chunks.push(logoAsHero ? "Brand logo as focal point." : "Small brand logo bottom-right corner.");
  }

  const visual = compressPedidoVisual(pedido, 260);
  if (visual) chunks.push(visual);
  if (brandCompact) chunks.push(brandCompact);
  if (frase) chunks.push(`Headline text exactly in Portuguese: "${frase}".`);
  else chunks.push("Minimal or no text.");
  chunks.push("No watermark, no gibberish, no misspelled words.");

  let full = chunks.join(" ");
  if (full.length > FLUX_IMAGE_PROMPT_COMPACT_TARGET) {
    full = `${full.slice(0, FLUX_IMAGE_PROMPT_COMPACT_TARGET - 1)}…`;
  }
  return full;
}

function buildFullImagePrompt({
  pedido,
  fraseNaImagem,
  identidadeDados,
  hasReferenceImage,
  referenceKind,
}) {
  const pedidoBudget = identidadeDados ? 780 : 1100;
  const pedidoBlock = formatPedidoBlock(pedido, fraseNaImagem, pedidoBudget);
  const brandBlock = identidadeDados
    ? formatBrandIdentityBlockForFlux(identidadeDados, 560)
    : "";

  const kind = referenceKind === "logo" ? "logo" : "product";
  const intro = introWithFrase(fraseNaImagem, hasReferenceImage, hasReferenceImage ? kind : "product");
  const logoCornerHint = identidadeDados?.id_midia_logo
    ? referenceKind === "logo"
      ? "\n\nBrand logo is the HERO element (client requested); still avoid illegible stretching."
      : "\n\nBrand logo: ALWAYS a small mark in a corner (bottom-right or top-left, ~8–12% of frame). Never centered, never full-bleed, unless the Client request explicitly says logo as hero."
    : "";

  const parts = [intro];
  if (logoCornerHint) parts.push(logoCornerHint);
  if (pedidoBlock) parts.push(`\n\n=== Client request ===\n${pedidoBlock}`);
  if (brandBlock) parts.push(`\n\n=== Brand identity ===\n${brandBlock}`);

  let full = parts.join("");
  if (full.length > FLUX_IMAGE_PROMPT_MAX) {
    full = full.slice(0, FLUX_IMAGE_PROMPT_MAX - 1) + "…";
  }
  return full;
}

/**
 * Monta prompt para geração de imagem.
 * Pipeline `raw` (GPT Image 2): pedido + identidade da marca.
 */
export function buildFluxImagePrompt({
  history,
  contextoRows,
  postContextProposal,
  hasReferenceImage = false,
  referenceKind = null,
  strictProductReference = false,
  composeProductAssets = false,
  productCount = 0,
  promptStyle,
  pipeline,
}) {
  const pipe = pipeline ?? env.IMAGE_PIPELINE ?? "raw";
  const { identidadeDados } = partitionContextosIdentidade(contextoRows);
  if (pipe === "raw") {
    return buildRawImagePrompt(history, postContextProposal, identidadeDados, {
      strictProductReference,
      composeProductAssets,
      productCount,
    });
  }

  const pedido = resolvePedidoCliente(postContextProposal, history);
  const fraseNaImagem = resolveFraseNaImagem(postContextProposal, history, contextoRows);
  const style = promptStyle ?? env.IMAGE_PROMPT_STYLE ?? "compact";
  const kind = referenceKind === "logo" ? "logo" : "product";

  if (style === "full") {
    return buildFullImagePrompt({
      pedido,
      fraseNaImagem,
      identidadeDados,
      hasReferenceImage,
      referenceKind: kind,
    });
  }

  const brandCompact = identidadeDados ? formatBrandIdentityCompact(identidadeDados) : "";
  return buildCompactImagePrompt({
    pedido,
    frase: fraseNaImagem,
    brandCompact,
    hasReferenceImage,
    referenceKind: kind,
    logoConfigured: Boolean(identidadeDados?.id_midia_logo),
    logoAsHero: kind === "logo",
  });
}

export function buildImagePreviewContextMeta(
  idEmpresa,
  empresaRow,
  contextoRows,
  postContextProposal,
  history,
) {
  const pipeline = env.IMAGE_PIPELINE || "raw";
  const frase_na_imagem =
    pipeline === "raw" ? null : resolveFraseNaImagem(postContextProposal, history || [], contextoRows);
  const pedido_resumo = resolvePedidoCliente(postContextProposal, history || [], 280);
  const { identidadeDados } = partitionContextosIdentidade(contextoRows);
  return {
    id_empresa: idEmpresa,
    empresa_nome_fantasia: empresaRow ? String(empresaRow.nome_fantasia ?? "").trim() || null : null,
    pedido_resumo: pedido_resumo || null,
    frase_na_imagem,
    identidade_configurada: Boolean(
      identidadeDados?.cor_primaria || identidadeDados?.estilo_visual || identidadeDados?.id_midia_logo,
    ),
    prompt_style: pipeline === "raw" ? "raw" : env.IMAGE_PROMPT_STYLE ?? "compact",
    image_provider: env.IMAGE_PROVIDER || "replicate",
    image_model:
      env.IMAGE_PROVIDER === "openai"
        ? env.OPENAI_IMAGE_MODEL || "gpt-image-2"
        : env.IMAGE_PROVIDER === "flux"
          ? "black-forest-labs/flux-schnell"
          : "openai/gpt-image-2",
  };
}
