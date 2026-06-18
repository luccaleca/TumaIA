import { env } from "../config.js";
import { filterMidiasAcervo } from "../modules/empresas/midiaOrigem.js";
import {
  buildComposeSceneResumo,
  buildResumoVisual,
  collectMandatoryImageFacts,
  extractFraseFromUserText,
  formatMandatoryTypographyBlock,
  mergeMandatoryFactsIntoResumo,
  normalizeFraseNaImagem,
  resolveFraseNaImagem,
  resolvePedidoCliente,
} from "./imageHeadline.js";
import { buildConfirmedImageIntent } from "./imageIntent.js";
import { aspectRatioFromArteBrief, promptFromArteBrief } from "./rawImageArteBrief.js";
import {
  formatBrandIdentityBlockForFlux,
  formatBrandIdentityCompact,
  formatBrandIdentityForRawPrompt,
  isIdentidadeMarcaContexto,
  partitionContextosIdentidade,
} from "../modules/empresas/identidadeMarca.js";
import { loadActiveModeloContextoRowsForEmpresa } from "./postModelosService.js";

/** Limite legado FLUX. */
export const FLUX_IMAGE_PROMPT_MAX = 2000;

import { buildOfficialGptImage2Prompt } from "./gptImage2OfficialRequest.js";

/**
 * Prompt integrado — delega ao formato oficial `images.edit` (um bloco + reference pictures).
 */
export function buildIntegratedProductImagePrompt(
  history,
  postContextProposal,
  identidadeDados = null,
  opts = {},
) {
  const proposal =
    postContextProposal && typeof postContextProposal === "object" ? postContextProposal : null;
  const imageIntent =
    opts?.imageIntent && typeof opts.imageIntent === "object"
      ? opts.imageIntent
      : buildConfirmedImageIntent({ history, postContextProposal: proposal, contextoRows: [] });
  const pedido = imageIntent?.pedido || resolvePedidoCliente(proposal, history, 32_000);
  const frase =
    imageIntent?.fraseNaImagem ||
    resolveFraseNaImagem(proposal, history, []) ||
    extractFraseFromUserText(pedido);
  const heroProductName =
    imageIntent?.heroProduct && typeof imageIntent.heroProduct.nome_exibicao === "string"
      ? imageIntent.heroProduct.nome_exibicao.trim()
      : "";

  const mandatoryTypography = formatMandatoryTypographyBlock(
    collectMandatoryImageFacts(history, proposal),
  );

  return buildOfficialGptImage2Prompt({
    nomeFantasia: identidadeDados?.nome_fantasia || null,
    productNames: opts?.productNames,
    pedido,
    fraseNaImagem: frase,
    mandatoryTypography,
    contextoNome: imageIntent?.matchedContexto?.nome || null,
    modeloPostPrompt: imageIntent?.playbookPromptBase || null,
    aspectRatio: opts?.aspectRatio || "1:1",
    logoInReferences: opts?.logoInReferences === true,
    heroProductName,
  });
}

/**
 * Instruções para pipeline raw com composição posterior de PNG do acervo (legado Sharp).
 *
 * @param {{ productCount?: number, heroProductName?: string }} [opts]
 */

/**
 * Segunda passada: harmonizar prévia já composta (Sharp) sem mover produtos.
 *
 * @param {import("./imageIntent.js").ConfirmedImageIntent} imageIntent
 */
export function buildRefineComposedImagePrompt(imageIntent) {
  const pedido = String(imageIntent?.pedido || "").trim();
  const frase = String(imageIntent?.fraseNaImagem || "").trim();
  return [
    "Esta imagem é uma prévia de post com produtos reais do acervo já posicionados.",
    "Ajuste APENAS iluminação, sombras, contraste e integração com o cenário — harmonia fotográfica.",
    "Mantenha EXATAMENTE posição, tamanho, rótulos e cores das embalagens; não redimensione nem mova produtos.",
    "Preserve todo texto promocional legível; não adicione blocos de texto novos em cima dos produtos.",
    "Não desenhe logo da marca.",
    pedido ? `Briefing: ${pedido}` : "",
    frase ? `Frase que deve permanecer legível: «${frase}».` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 32_000);
}

/**
 * Edição incremental: prévia anterior + pedido pontual do cliente (ex.: incluir preço).
 *
 * @param {{
 *   instructions: string,
 *   history?: Array<{ role: string, content: string }>,
 *   proposal?: Record<string, unknown>,
 *   imageIntent?: import("./imageIntent.js").ConfirmedImageIntent | null,
 * }} opts
 */
export function buildImageRevisionPrompt(opts) {
  const instructions = String(opts.instructions || "").trim();
  const history = Array.isArray(opts.history) ? opts.history : [];
  const proposal = opts.proposal && typeof opts.proposal === "object" ? opts.proposal : {};
  const imageIntent = opts.imageIntent && typeof opts.imageIntent === "object" ? opts.imageIntent : null;
  const facts = collectMandatoryImageFacts(history, proposal);
  const mandatory = formatMandatoryTypographyBlock(facts);
  const frase =
    String(imageIntent?.fraseNaImagem || "").trim() ||
    String(proposal.frase_na_imagem ?? "").trim();

  return [
    "Edição de prévia já gerada para post promocional (Instagram).",
    "Use a imagem anexa como base. Mantenha composição, produtos, cores da marca, logo, cenário e tipografia existente.",
    "Faça SOMENTE as alterações pedidas pelo cliente — não redesenhe do zero.",
    "Se pedirem preço, CTA ou texto promocional, inclua de forma legível sem apagar elementos que devem permanecer.",
    instructions ? `Alterações solicitadas: ${instructions}` : "",
    frase ? `Frase que deve continuar legível (se já existir): «${frase}»` : "",
    mandatory ? mandatory : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 32_000);
}

export function buildComposeBackgroundDirectives(opts = {}) {
  const n = Math.max(1, Math.min(3, Number(opts.productCount) || 1));
  const hero = String(opts.heroProductName ?? "").trim();
  const zoneHint =
    n === 1
      ? "terço inferior central (~30–38% da largura, da base até ~50% da altura)"
      : n === 2
        ? "dois vãos no terço inferior (esquerda ~20% da largura; centro-direita ~26% para o hero)"
        : "três vãos no terço inferior (laterais ~18% cada; centro ~26% para o hero)";
  const heroLine = hero
    ? `O maior vão é para «${hero}»; os demais são de apoio.`
    : "O maior vão é para o produto principal; os demais são de apoio.";

  return [
    "MODO FUNDO PARA COLAGEM (obrigatório): gere APENAS cenário, iluminação, props decorativos, tipografia de campanha e superfície de apoio contínua.",
    `Reserve ${n} zona(s) vazia(s) no ${zoneHint}, sem objeto sólido, sem silhueta e sem cor chapada de placeholder. ${heroLine}`,
    "A superfície/pedestal deve ser contínua (mesmo material/textura do cenário), visível e vazia — os PNG reais do acervo serão colados depois.",
    "PROIBIDO: desenhar pote, lata, sachê, caixa, rótulo, mockup de suplemento, frasco genérico, jar vazio, retângulo branco central, área em branco tipo placeholder, produto inventado ou layout de embalagem fictícia.",
    "PERMITIDO: texto promocional (preço, CTA, frase), luz, fumaça, partículas, fundo gradiente/texturizado, elementos de cenário que NÃO ocupem as zonas reservadas.",
    "TIPOGRAFIA: títulos, preços, listas e bullets SOMENTE no terço superior (acima de ~42% da altura) ou faixa superior lateral — NUNCA no terço inferior nem atrás da faixa onde os PNG dos produtos serão colados.",
  ].join(" ");
}

export const FLUX_IMAGE_PROMPT_COMPACT_TARGET = 520;

/**
 * Prompt para GPT Image 2 (pipeline raw): pedido do cliente + identidade da marca.
 *
 * @param {Array<{ role: string, content: string }>} history
 * @param {Record<string, unknown> | null | undefined} postContextProposal
 * @param {Record<string, unknown> | null | undefined} identidadeDados
 * @param {{
 *   strictProductReference?: boolean,
 *   composeProductAssets?: boolean,
 *   integratedProductGeneration?: boolean,
 *   productNames?: string[],
 *   productCount?: number,
 *   logoAsHero?: boolean,
 * }} [opts]
 */
export function buildRawImagePrompt(history, postContextProposal, identidadeDados = null, opts = {}) {
  if (opts?.integratedProductGeneration) {
    return buildIntegratedProductImagePrompt(history, postContextProposal, identidadeDados, {
      productNames: opts.productNames,
      imageIntent: opts.imageIntent,
      aspectRatio: opts.aspectRatio,
      logoInReferences: opts.logoInReferences,
    });
  }
  const proposal =
    postContextProposal && typeof postContextProposal === "object" ? postContextProposal : null;
  const imageIntent =
    opts?.imageIntent && typeof opts.imageIntent === "object"
      ? opts.imageIntent
      : buildConfirmedImageIntent({ history, postContextProposal: proposal, contextoRows: [] });
  const arteBrief = proposal?.arte_brief;
  const hasPhraseOverride = Boolean(
    proposal && Object.prototype.hasOwnProperty.call(proposal, "frase_na_imagem"),
  );
  const phraseOverride = hasPhraseOverride ? normalizeFraseNaImagem(proposal?.frase_na_imagem) || "" : null;
  let base = "";
  if (arteBrief && typeof arteBrief === "object") {
    const promptBrief =
      hasPhraseOverride && arteBrief && typeof arteBrief === "object"
        ? {
            ...arteBrief,
            titulo: "",
            subtitulo: "",
            texto: "",
          }
        : arteBrief;
    const fromBrief = promptFromArteBrief(/** @type {Record<string, unknown>} */ (promptBrief));
    if (fromBrief.trim()) base = fromBrief;
  }
  if (!base) {
    const pedido = imageIntent?.pedido || resolvePedidoCliente(postContextProposal, history, 32_000);
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
  const heroProductName =
    imageIntent?.heroProduct && typeof imageIntent.heroProduct.nome_exibicao === "string"
      ? imageIntent.heroProduct.nome_exibicao.trim()
      : "";
  if (composeProductAssets) {
    base = `${base}\n\n${buildComposeBackgroundDirectives({
      productCount,
      heroProductName,
    })}`;
  }
  const pedidoTexto = imageIntent?.pedido || resolvePedidoCliente(proposal, history, 32_000);
  const resumoFromProposal =
    proposal && typeof proposal.resumo_visual === "string" && proposal.resumo_visual.trim()
      ? proposal.resumo_visual.trim()
      : "";
  const resumoVisual = composeProductAssets
    ? buildComposeSceneResumo(proposal, history || [], pedidoTexto)
    : resumoFromProposal
      ? mergeMandatoryFactsIntoResumo(resumoFromProposal, history || [], proposal)
      : buildResumoVisual(proposal, history || [], pedidoTexto);
  const mandatoryTypography = formatMandatoryTypographyBlock(
    collectMandatoryImageFacts(history || [], proposal),
  );
  const resumoLabel = composeProductAssets
    ? "Direção do cenário (somente fundo — produtos reais entram depois na colagem)"
    : "Direção visual da arte (composição completa — preços, promoção, público e produtos do pedido; não limitar a uma única palavra)";
  base = `${base}\n\n${resumoLabel}: ${resumoVisual}`;

  const fraseExplicita =
    hasPhraseOverride && phraseOverride
      ? phraseOverride
      : extractFraseFromUserText(pedidoTexto) ||
        (imageIntent?.fraseNaImagem && extractFraseFromUserText(String(imageIntent.fraseNaImagem))
          ? imageIntent.fraseNaImagem
          : null);
  if (mandatoryTypography) {
    base = `${base}\n\n${mandatoryTypography} Prioridade absoluta sobre qualquer criatividade visual — se o cliente informou preço ou ocasião, deve aparecer legível na arte.`;
  }
  if (fraseExplicita) {
    base = `${base}\n\nO cliente pediu este texto em destaque na arte: «${fraseExplicita}». Pode incluir também preços e chamadas do pedido de forma legível.`;
  } else if (hasPhraseOverride && !phraseOverride) {
    base = `${base}\n\nEvite texto legível longo; foque no visual e nos produtos do acervo.`;
  } else if (composeProductAssets) {
    base = `${base}\n\nTipografia de campanha (preços, desconto, público) pode aparecer como texto gráfico; não desenhe embalagens nem mockups de produto.`;
  } else if (!mandatoryTypography) {
    base = `${base}\n\nUse os elementos textuais do pedido (ex.: preços, desconto, público-alvo) de forma legível na composição, conforme o resumo acima.`;
  }
  if (composeProductAssets) {
    base = `${base}\n\nReforce: nenhum objeto de produto no quadro — apenas cenário vazio nas zonas reservadas para os PNG do acervo.`;
  }
  if (imageIntent?.playbookPromptBase) {
    base = `${base}\n\nModelo de post (playbook visual):\n${imageIntent.playbookPromptBase}`;
  } else if (imageIntent?.matchedContexto?.nome) {
    base = `${base}\n\nContexto/campanha prioritário desta arte: ${imageIntent.matchedContexto.nome}.`;
  }
  if (identidadeDados?.id_midia_logo && !opts?.logoAsHero) {
    base = `${base}\n\nA logo real será aplicada depois como MARCA D'ÁGUA discreta num canto livre (~7–9% da altura, semitransparente): identifica a empresa, mas o foco é a campanha e os produtos. Não desenhe logo, wordmark nem lettering na arte gerada — deixe canto inferior livre de textos grandes.`;
  }

  const brand = identidadeDados ? formatBrandIdentityForRawPrompt(identidadeDados) : "";
  if (brand) {
    return `${base}\n\nIdentidade da marca (alinhar visual e cores):\n${brand}`.slice(0, 32_000);
  }
  return base.slice(0, 32_000);
}

/**
 * Contextos ativos da empresa: modelos de post (boolean) + identidade da marca.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 */
export async function loadContextosEmpresaAtivos(db, idEmpresa) {
  const [modeloRows, identidadeResult] = await Promise.all([
    loadActiveModeloContextoRowsForEmpresa(db, idEmpresa),
    db
      .from("contexto_empresa")
      .select("id_contexto_empresa, nome, descricao, schema_json, dados_json, data_criacao")
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true)
      .order("data_criacao", { ascending: false })
      .limit(8),
  ]);
  if (identidadeResult.error) throw new Error(identidadeResult.error.message);
  const identidadeRows = (Array.isArray(identidadeResult.data) ? identidadeResult.data : []).filter(
    (row) => isIdentidadeMarcaContexto(row),
  );
  return [...modeloRows, ...identidadeRows];
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

export async function loadMidiasEmpresaResumo(db, idEmpresa, limit = 72) {
  const { data, error } = await db
    .from("midia")
    .select(
      "id_midia, nome_exibicao, nome_arquivo, descricao, alt_text, tipo_midia, formato_arquivo, caminho_storage, data_criacao",
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
        ? "The reference image is the brand LOGO only: place a legible logo mark in one corner (about 22–28% of the frame height), never centered, never full-bleed, never enlarged to fill the canvas. Build a new scene around it (product, promo background)."
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
  heroProductName,
}) {
  const chunks = ["Square 1:1 Instagram ad, premium, clean, high quality."];

  if (hasReferenceImage) {
    chunks.push(
      referenceKind === "logo"
        ? "Use reference as small corner logo only."
        : "Hero product from reference image, new layout, preserve exact package design and label.",
    );
  } else if (logoConfigured) {
    chunks.push(
      logoAsHero ? "Brand logo as focal point." : "Do not draw logo — added later as brand watermark (subtle, corner).",
    );
  }

  const visual = compressPedidoVisual(pedido, 260);
  if (visual) chunks.push(visual);
  if (heroProductName) chunks.push(`Main product highlight: ${heroProductName}.`);
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
  heroProductName,
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
      : "\n\nDo NOT draw the brand logo in the image — it is added later as a subtle watermark (corner, ~7–9% height, not the focal point). Keep bottom corners clear of large text blocks."
    : "";

  const parts = [intro];
  if (heroProductName) parts.push(`\n\n=== Hero product ===\nPrioritize this product as the main visual focus: ${heroProductName}`);
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
  focusContextoId = null,
  hasReferenceImage = false,
  referenceKind = null,
  strictProductReference = false,
  composeProductAssets = false,
  productCount = 0,
  productNames = [],
  integratedProductGeneration = false,
  logoInReferences = false,
  aspectRatio = "1:1",
  promptStyle,
  pipeline,
}) {
  const pipe = pipeline ?? env.IMAGE_PIPELINE ?? "raw";
  const { identidadeDados } = partitionContextosIdentidade(contextoRows);
  const imageIntent = buildConfirmedImageIntent({
    history,
    postContextProposal,
    contextoRows,
    focusContextoId,
  });
  if (pipe === "raw") {
    return buildRawImagePrompt(history, imageIntent.postContextProposal, identidadeDados, {
      strictProductReference,
      composeProductAssets,
      integratedProductGeneration,
      productNames,
      productCount,
      logoInReferences,
      aspectRatio,
      logoAsHero: referenceKind === "logo",
      imageIntent,
    });
  }

  const pedido = imageIntent.pedido || resolvePedidoCliente(postContextProposal, history);
  const fraseNaImagem = imageIntent.fraseNaImagem || resolveFraseNaImagem(postContextProposal, history, contextoRows);
  const style = promptStyle ?? env.IMAGE_PROMPT_STYLE ?? "compact";
  const kind = referenceKind === "logo" ? "logo" : "product";

  if (style === "full") {
    return buildFullImagePrompt({
      pedido,
      fraseNaImagem,
      identidadeDados,
      hasReferenceImage,
      referenceKind: kind,
      heroProductName:
        imageIntent?.heroProduct && typeof imageIntent.heroProduct.nome_exibicao === "string"
          ? imageIntent.heroProduct.nome_exibicao.trim()
          : "",
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
    heroProductName:
      imageIntent?.heroProduct && typeof imageIntent.heroProduct.nome_exibicao === "string"
        ? imageIntent.heroProduct.nome_exibicao.trim()
        : "",
  });
}

export function buildImagePreviewContextMeta(
  idEmpresa,
  empresaRow,
  contextoRows,
  postContextProposal,
  history,
  focusContextoId = null,
) {
  const pipeline = env.IMAGE_PIPELINE || "raw";
  const imageIntent = buildConfirmedImageIntent({
    history: history || [],
    postContextProposal,
    contextoRows,
    focusContextoId,
  });
  const frase_na_imagem = imageIntent.fraseNaImagem || null;
  const pedido_resumo = (imageIntent.pedido || resolvePedidoCliente(postContextProposal, history || [], 280)).slice(
    0,
    280,
  );
  const { identidadeDados } = partitionContextosIdentidade(contextoRows);
  return {
    id_empresa: idEmpresa,
    empresa_nome_fantasia: empresaRow ? String(empresaRow.nome_fantasia ?? "").trim() || null : null,
    pedido_resumo: pedido_resumo || null,
    frase_na_imagem,
    hero_product: imageIntent.heroProduct || null,
    contexto_prioritario: imageIntent.matchedContexto?.nome || null,
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
