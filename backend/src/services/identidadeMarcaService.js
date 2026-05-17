import { env } from "../config.js";
import {
  IDENTIDADE_CONTEXTO_NOME,
  IDENTIDADE_TIPO,
  isIdentidadeMarcaContexto,
  normalizeIdentidadeDados,
  identidadeCompletude,
} from "../modules/empresas/identidadeMarca.js";
import { resolverTipoETemplate } from "../modules/empresas/shared.js";
import {
  llamaChatCompletionJson,
  llamaChatCompletionVisionJson,
} from "./llamaOpenAiClient.js";
import { fetchImageAsDataUrl } from "./llamaVisionImage.js";
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
 * }} input
 */
function buildAnalisePrompt(input) {
  const parts = [
    "Você analisa a identidade de marca de uma empresa para preencher um formulário.",
    "Responda APENAS JSON válido com as chaves exatas:",
    '{"sobre_empresa":"string","segmento":"string","tom_voz":"string (adjuntos separados por vírgula)","estilo_visual":"string","evitar":"string","publico":"string","cor_primaria":"#RRGGBB ou vazio","cor_secundaria":"#RRGGBB ou vazio","exemplo_frase_marca":"string curta"}',
    "Regras: português BR; cores em hex se inferir da descrição ou da imagem; não invente CNPJ; tom_voz máx 8 palavras-chave; exemplo_frase_marca máx 8 palavras.",
    "estilo_visual deve ser útil para gerar imagens (cores, mood, layout limpo ou não).",
    'evitar deve incluir "copiar posts antigos" se relevante.',
  ];
  if (input.comImagemPixels) {
    parts.push(
      "Há uma imagem anexa: use os PIXELS para inferir paleta (cor_primaria, cor_secundaria), estilo visual e tom.",
      "Não copie o layout do post — só identidade (cores, mood, tipografia se visível).",
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
    throw new Error("IA não configurada (LLAMA_BASE_URL / LLAMA_MODEL).");
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
    imageDataUrl = await fetchImageAsDataUrl(imageUrl);
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
  });

  const textModel = (env.LLAMA_PROPOSAL_MODEL || env.LLAMA_MODEL || "llama3.2:3b").trim();
  const visionModel = (env.LLAMA_VISION_MODEL || "llava:7b").trim();

  const { parsed, model: modelUsed } = comImagemPixels
    ? await llamaChatCompletionVisionJson(prompt, [imageDataUrl], {
        model: visionModel,
        temperature: 0.25,
      })
    : await llamaChatCompletionJson(prompt, { model: textModel, temperature: 0.25 });

  const sugestao = normalizeIdentidadeDados({
    ...parsed,
    site_url: siteUrl || undefined,
    id_midia_referencia_analise: idMidia || undefined,
    legenda_referencia: legendaPost || undefined,
  });

  return {
    sugestao,
    completude: identidadeCompletude(sugestao),
    fontes: {
      site: Boolean(siteText),
      midia: Boolean(idMidia),
      midia_visao: comImagemPixels,
      legenda: Boolean(legendaPost),
    },
    modelo: modelUsed,
  };
}
