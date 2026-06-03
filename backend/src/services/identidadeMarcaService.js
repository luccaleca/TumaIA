import { env } from "../config.js";
import { DEFAULT_OLLAMA_CHAT_MODEL } from "../ollamaDefaults.js";
import {
  IDENTIDADE_CONTEXTO_NOME,
  IDENTIDADE_TIPO,
  isIdentidadeMarcaContexto,
  normalizeIdentidadeDados,
  identidadeCompletude,
  refineIdentidadeFromAnalysis,
} from "../modules/empresas/identidadeMarca.js";
import { resolverTipoETemplate } from "../modules/empresas/shared.js";
import {
  llamaChatCompletionJson,
  llamaChatCompletionVisionJson,
} from "./llamaOpenAiClient.js";
import { extractBrandPaletteFromBuffer } from "./imagePaletteExtract.js";
import { fetchImageBuffer } from "./llamaVisionImage.js";
import { resolveFetchableImageUrlForMidia } from "./referenceMidiaUrls.js";
import { fetchWebsiteText } from "./websiteTextExtract.js";

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 */
export async function findIdentidadeContextoRow(supabase, idEmpresa) {
  const { data, error } = await supabase
    .from("contexto_empresa")
    .select(
      "id_contexto_empresa, nome, descricao, schema_json, dados_json, data_criacao, data_atualizacao",
    )
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .order("data_criacao", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  return rows.find((r) => isIdentidadeMarcaContexto(r)) || null;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 * @param {string} idUsuario
 * @param {Record<string, unknown>} dados
 */
export async function upsertIdentidadeMarca(supabase, idEmpresa, idUsuario, dados) {
  const normalized = normalizeIdentidadeDados(dados);
  const existing = await findIdentidadeContextoRow(supabase, idEmpresa);
  const descricao =
    "Identidade visual e tom de voz da marca. Usado para gerar artes e textos alinhados.";
  const schema_json = { tipo: IDENTIDADE_TIPO, versao: 1 };
  const dados_json = normalized;

  if (existing?.id_contexto_empresa) {
    const { data: updated, error } = await supabase
      .from("contexto_empresa")
      .update({
        nome: IDENTIDADE_CONTEXTO_NOME,
        descricao,
        schema_json,
        dados_json,
      })
      .eq("id_contexto_empresa", existing.id_contexto_empresa)
      .eq("id_empresa", idEmpresa)
      .select(
        "id_contexto_empresa, nome, descricao, schema_json, dados_json, data_criacao, data_atualizacao",
      )
      .maybeSingle();
    if (error) throw new Error(error.message);
    return updated;
  }

  const resolved = await resolverTipoETemplate(supabase, IDENTIDADE_TIPO);
  const { data: created, error: eIns } = await supabase
    .from("contexto_empresa")
    .insert({
      id_empresa: idEmpresa,
      id_tipo_contexto: resolved.idTipoContexto,
      id_template: resolved.idTemplate,
      criado_por_usuario_id: idUsuario,
      nome: IDENTIDADE_CONTEXTO_NOME,
      descricao,
      schema_json,
      dados_json,
      ativo: true,
    })
    .select(
      "id_contexto_empresa, nome, descricao, schema_json, dados_json, data_criacao, data_atualizacao",
    )
    .single();
  if (eIns) throw new Error(eIns.message);
  return created;
}

/**
 * @param {{
 *   empresaNome?: string,
 *   empresaDescricao?: string,
 *   siteText?: string,
 *   siteUrl?: string,
 *   midiaMeta?: { nome?: string, descricao?: string, alt_text?: string },
 *   legendaPost?: string,
 *   comImagemPixels?: boolean,
 *   paletteHint?: { primary?: string | null, secondary?: string | null, accents?: string[] },
 * }} input
 */
function buildAnalisePrompt(input) {
  const comFoto = Boolean(input.comImagemPixels);
  const parts = [
    "Você analisa identidade de marca para pequenos negócios no Brasil.",
    "Responda APENAS um JSON válido (sem markdown, sem texto fora do JSON).",
  ];

  if (comFoto) {
    parts.push(
      "Schema:",
      '{"sobre_empresa":"1-2 frases","segmento":"categoria","tom_voz":"3-6 adjetivos, vírgula","estilo_visual":"1 frase mood/layout, sem cores","assinatura_visual":"1-2 frases com o padrão fixo da marca","variacoes_campanha":"1 frase com o que pode mudar por campanha","regras_repeticao":"1 frase com regras recorrentes de layout","estrategia_cor_campanha":"1 frase explicando como variar a cor por produto/campanha","evitar":"2-4 itens curtos para o designer","publico":"público-alvo","exemplo_frase_marca":"máx 8 palavras","cores_marca":["#RRGGBB"]}',
      "cores_marca: obrigatório, 4 a 6 hex — logo, botões, fundos e textos da interface (inclua branco/preto se forem da UI).",
      "evitar: exemplos do que não colocar nas artes (fotos genéricas, fontes difíceis). Não repita estas instruções.",
      "estilo_visual: mood e layout (limpo, premium, divertido…) — sem hex, sem nomes de cor (verde, azul…); cores vão só em cores_marca.",
      "assinatura_visual: extraia o que se repete na marca (tipografia, contraste, protagonismo do produto, posição do logo, composição).",
      "variacoes_campanha: descreva o que pode mudar sem perder a identidade (cor da campanha, fundo temático, CTA, selo, props).",
      "regras_repeticao: diga as regras reutilizáveis da peça, sem copiar um post específico.",
      "estrategia_cor_campanha: explique como a marca varia a cor por produto/campanha usando a paleta base; pode citar hex base como #FFFFFF se fizer sentido.",
    );
    const hintHexes = [
      input.paletteHint?.primary,
      input.paletteHint?.secondary,
      ...(Array.isArray(input.paletteHint?.accents) ? input.paletteHint.accents : []),
    ].filter(Boolean);
    if (hintHexes.length) {
      parts.push(
        "Sugestão automática por pixels (confirme ou corrija em cores_marca com o que você vê):",
        hintHexes.join(", "),
      );
    }
  } else {
    parts.push(
      "Schema:",
      '{"sobre_empresa":"","segmento":"","tom_voz":"","estilo_visual":"","assinatura_visual":"","variacoes_campanha":"","regras_repeticao":"","estrategia_cor_campanha":"","evitar":"","publico":"","cor_primaria":"#RRGGBB ou vazio","cor_secundaria":"#RRGGBB ou vazio","exemplo_frase_marca":""}',
      "cor_primaria/cor_secundaria: só se o site ou texto citar cores de forma clara.",
    );
  }

  parts.push(
    "Regras gerais:",
    "- Português BR; específico ao material; não invente CNPJ, endereço ou prêmios.",
    "- tom_voz: adjetivos separados por vírgula.",
    "- evitar: frases curtas para quem cria artes — nunca copie o texto deste prompt.",
    "- exemplo_frase_marca: frase curta no tom da marca.",
    "- Não descreva layout exato de um post; extraia identidade reutilizável.",
  );
  if (input.empresaNome) parts.push(`\nNome fantasia: ${input.empresaNome}`);
  if (input.empresaDescricao) parts.push(`\nCadastro empresa: ${input.empresaDescricao.slice(0, 800)}`);
  if (input.siteUrl) parts.push(`\nSite: ${input.siteUrl}`);
  if (input.siteText) parts.push(`\nTexto do site:\n${input.siteText.slice(0, 6000)}`);
  if (input.midiaMeta) {
    const rotulo = input.comImagemPixels
      ? "\nImagem de referência (metadados do acervo — complemento ao que você vê na imagem):"
      : "\nPost/imagem de referência (só metadados — NÃO copiar layout):";
    parts.push(
      rotulo,
      `nome: ${input.midiaMeta.nome || "—"}`,
      `descrição: ${input.midiaMeta.descricao || "—"}`,
      `alt: ${input.midiaMeta.alt_text || "—"}`,
    );
  }
  if (input.legendaPost) parts.push(`\nLegenda do post:\n${input.legendaPost.slice(0, 1500)}`);
  if (!input.siteText && !input.midiaMeta && !input.legendaPost) {
    parts.push("\nPoucos dados: infira o mínimo a partir do cadastro da empresa.");
  }
  return parts.join("\n");
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 * @param {{
 *   site_url?: string,
 *   id_midia?: string,
 *   legenda_post?: string,
 *   image_base64?: string,
 *   mime_type?: string,
 *   nome_arquivo?: string,
 * }} opts
 * @param {Record<string, unknown> | null} empresaRow
 */
export async function analisarIdentidadeMarca(supabase, idEmpresa, opts, empresaRow) {
  if (!env.LLAMA_BASE_URL?.trim() && !env.LLAMA_MODEL?.trim()) {
    throw new Error("O Tuma não está configurado (LLAMA_BASE_URL / LLAMA_MODEL no .env).");
  }

  let siteText;
  let siteUrl = opts.site_url ? String(opts.site_url).trim() : "";
  if (!siteUrl && empresaRow?.site_empresa) {
    siteUrl = String(empresaRow.site_empresa).trim();
  }
  if (siteUrl) {
    const fetched = await fetchWebsiteText(siteUrl);
    siteText = fetched.text;
    siteUrl = fetched.url;
  }

  let midiaMeta = null;
  let imageDataUrl = null;
  /** @type {{ primary: string | null, secondary: string | null } | null} */
  let paletteFromPixels = null;
  const imageB64 = opts.image_base64 ? String(opts.image_base64).trim() : "";
  const idMidia = opts.id_midia ? String(opts.id_midia).trim() : "";

  if (imageB64) {
    let imageBuffer;
    try {
      imageBuffer = Buffer.from(imageB64, "base64");
    } catch {
      throw new Error("image_base64 inválido.");
    }
    if (!imageBuffer.length) throw new Error("Imagem vazia.");
    const mime = String(opts.mime_type || "image/jpeg")
      .trim()
      .toLowerCase()
      .split(";")[0];
    const safeMime = mime.startsWith("image/") ? mime : "image/jpeg";
    imageDataUrl = `data:${safeMime};base64,${imageBuffer.toString("base64")}`;
    midiaMeta = {
      nome: String(opts.nome_arquivo ?? "").trim() || "Imagem para análise",
      descricao: "",
      alt_text: "",
    };
    try {
      paletteFromPixels = await extractBrandPaletteFromBuffer(imageBuffer);
    } catch (err) {
      console.warn("identidadeMarca.palette:", err instanceof Error ? err.message : err);
    }
  } else if (idMidia) {
    const { data: midia, error } = await supabase
      .from("midia")
      .select(
        "id_midia, nome_exibicao, descricao, alt_text, tipo_midia, caminho_storage, url_arquivo",
      )
      .eq("id_empresa", idEmpresa)
      .eq("id_midia", idMidia)
      .eq("ativo", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!midia) throw new Error("Mídia de referência não encontrada.");
    if (String(midia.tipo_midia || "").toLowerCase() !== "imagem") {
      throw new Error("Selecione uma imagem do acervo para análise.");
    }
    midiaMeta = {
      nome: String(midia.nome_exibicao ?? "").trim(),
      descricao: String(midia.descricao ?? "").trim(),
      alt_text: String(midia.alt_text ?? "").trim(),
    };
    const imageUrl = await resolveFetchableImageUrlForMidia(supabase, midia);
    const { buffer: imageBuffer, mime } = await fetchImageBuffer(imageUrl);
    imageDataUrl = `data:${mime};base64,${imageBuffer.toString("base64")}`;
    try {
      paletteFromPixels = await extractBrandPaletteFromBuffer(imageBuffer);
    } catch (err) {
      console.warn("identidadeMarca.palette:", err instanceof Error ? err.message : err);
    }
  }

  const legendaPost = String(opts.legenda_post ?? "").trim();
  if (!siteText && !imageDataUrl && !legendaPost && !empresaRow?.descricao) {
    throw new Error("Informe o site, uma imagem ou a legenda de um post.");
  }

  const comImagemPixels = Boolean(imageDataUrl);
  const prompt = buildAnalisePrompt({
    empresaNome: empresaRow ? String(empresaRow.nome_fantasia ?? "") : "",
    empresaDescricao: empresaRow ? String(empresaRow.descricao ?? "") : "",
    siteText,
    siteUrl,
    midiaMeta,
    legendaPost,
    comImagemPixels,
    paletteHint: paletteFromPixels,
  });

  const textModel = (
    env.IDENTIDADE_ANALISE_MODEL ||
    env.LLAMA_PROPOSAL_MODEL ||
    env.LLAMA_MODEL ||
    DEFAULT_OLLAMA_CHAT_MODEL
  ).trim();
  const visionModel = (env.IDENTIDADE_VISION_MODEL || env.LLAMA_VISION_MODEL || "llava:7b").trim();

  const { parsed, model: modelUsed } = comImagemPixels
    ? await llamaChatCompletionVisionJson(prompt, [imageDataUrl], {
        model: visionModel,
        temperature: 0.08,
      })
    : await llamaChatCompletionJson(prompt, { model: textModel, temperature: 0.18 });

  const sugestao = refineIdentidadeFromAnalysis(
    typeof parsed === "object" && parsed ? parsed : {},
    paletteFromPixels,
    empresaRow,
  );

  const sugestaoFinal = normalizeIdentidadeDados({
    ...sugestao,
    id_midia_referencia_analise: idMidia && !imageB64 ? idMidia : undefined,
    legenda_referencia: legendaPost || undefined,
  });

  return {
    sugestao: sugestaoFinal,
    completude: identidadeCompletude(sugestaoFinal),
    fontes: {
      site: Boolean(siteText),
      midia: Boolean(idMidia),
      midia_visao: comImagemPixels,
      paleta_pixels: Boolean(paletteFromPixels?.primary),
      legenda: Boolean(legendaPost),
    },
    modelo: modelUsed,
  };
}
