import { env } from "../config.js";
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
 *   paletteHint?: { primary?: string | null, secondary?: string | null },
 * }} input
 */
function buildAnalisePrompt(input) {
  const comFoto = Boolean(input.comImagemPixels);
  const parts = [
    "Você é o Tuma, especialista em identidade de marca para pequenos negócios no Brasil.",
    "Analise o material e preencha o formulário. Responda APENAS um JSON válido, sem markdown.",
  ];

  if (comFoto && input.paletteHint?.primary) {
    parts.push(
      'Chaves obrigatórias (NÃO inclua cor_primaria nem cor_secundaria — as cores já foram detectadas):',
      '{"sobre_empresa":"string","segmento":"string","tom_voz":"string","estilo_visual":"string","evitar":"string","publico":"string","exemplo_frase_marca":"string"}',
      `Paleta já detectada na imagem: primária ${input.paletteHint.primary}, secundária ${input.paletteHint.secondary || "—"}.`,
      "Mencione essas cores em estilo_visual (mood, contraste, sensação).",
    );
  } else {
    parts.push(
      "Chaves obrigatórias:",
      '{"sobre_empresa":"string","segmento":"string","tom_voz":"string","estilo_visual":"string","evitar":"string","publico":"string","cor_primaria":"#RRGGBB ou vazio","cor_secundaria":"#RRGGBB ou vazio","exemplo_frase_marca":"string"}',
    );
  }

  parts.push(
    "Regras:",
    "- Português BR; seja específico ao que vê ou lê; não invente CNPJ, endereço ou prêmios.",
    "- tom_voz: 3 a 6 adjetivos separados por vírgula (ex: acolhedor, direto, premium).",
    "- estilo_visual: 1 frase sobre mood + layout (limpo, popular, luxo, divertido…).",
    "- evitar: o que NÃO combina com a marca nas artes.",
    "- exemplo_frase_marca: frase curta no tom da marca (máx 8 palavras).",
    "- Não descreva o layout exato do post; extraia identidade reutilizável.",
  );

  if (comFoto) {
    parts.push(
      "Há uma imagem: descreva tom, público e estilo pelo que aparece (produto, tipografia, cenário).",
      "Se for só preto e branco, foque no estilo sem inventar cores.",
    );
  }
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
 * @param {{ site_url?: string, id_midia?: string, legenda_post?: string }} opts
 * @param {Record<string, unknown> | null} empresaRow
 */
export async function analisarIdentidadeMarca(supabase, idEmpresa, opts, empresaRow) {
  if (!env.LLAMA_BASE_URL?.trim() && !env.LLAMA_MODEL?.trim()) {
    throw new Error("O Tuma não está configurado (LLAMA_BASE_URL / LLAMA_MODEL no .env).");
  }

  let siteText;
  let siteUrl = opts.site_url ? String(opts.site_url).trim() : "";
  if (siteUrl) {
    const fetched = await fetchWebsiteText(siteUrl);
    siteText = fetched.text;
    siteUrl = fetched.url;
  }

  let midiaMeta = null;
  let imageDataUrl = null;
  /** @type {{ primary: string | null, secondary: string | null } | null} */
  let paletteFromPixels = null;
  const idMidia = opts.id_midia ? String(opts.id_midia).trim() : "";
  if (idMidia) {
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
  if (!siteText && !midiaMeta && !legendaPost && !empresaRow?.descricao) {
    throw new Error("Informe o link do site, uma imagem do acervo ou a legenda de um post.");
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

  const textModel = (env.LLAMA_PROPOSAL_MODEL || env.LLAMA_MODEL || "llama3.2:3b").trim();
  const visionModel = (env.LLAMA_VISION_MODEL || "llava:7b").trim();

  const { parsed, model: modelUsed } = comImagemPixels
    ? await llamaChatCompletionVisionJson(prompt, [imageDataUrl], {
        model: visionModel,
        temperature: 0.12,
      })
    : await llamaChatCompletionJson(prompt, { model: textModel, temperature: 0.2 });

  const sugestao = refineIdentidadeFromAnalysis(
    typeof parsed === "object" && parsed ? parsed : {},
    paletteFromPixels,
    empresaRow,
  );

  const sugestaoFinal = normalizeIdentidadeDados({
    ...sugestao,
    site_url: siteUrl || undefined,
    id_midia_referencia_analise: idMidia || undefined,
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
