/**
 * Legenda + hashtags para Instagram após a prévia da imagem.
 */

import { env } from "../config.js";
import { DEFAULT_OLLAMA_CHAT_MODEL } from "../ollamaDefaults.js";
import { partitionContextosIdentidade } from "../modules/empresas/identidadeMarca.js";
import { recordLlamaTextCall } from "./llamaUsage.js";
import { loadContextosEmpresaAtivos } from "./imagePreviewPrompt.js";
import {
  collectMandatoryImageFacts,
  resolvePedidoCliente,
  userTextBlobFromHistory,
} from "./imageHeadline.js";
import { chatCompletionJson, resolveTextProvider } from "./textCompletionService.js";

/**
 * @param {{
 *   history: Array<{ role: string, content: string }>,
 *   proposal?: Record<string, unknown> | null,
 *   identidadeDados?: Record<string, unknown> | null,
 *   nomeFantasia?: string | null,
 *   limiteHashtags?: number,
 *   revisionInstructions?: string | null,
 *   previousCaption?: string | null,
 * }} ctx
 */
export function buildPostCaptionPrompt(ctx) {
  const history = Array.isArray(ctx.history) ? ctx.history : [];
  const proposal = ctx.proposal && typeof ctx.proposal === "object" ? ctx.proposal : {};
  const limiteHashtags = Math.min(30, Math.max(3, Number(ctx.limiteHashtags) || 12));
  const identidade = ctx.identidadeDados && typeof ctx.identidadeDados === "object" ? ctx.identidadeDados : {};

  const pedido =
    resolvePedidoCliente(proposal, history, 2400) ||
    userTextBlobFromHistory(history).slice(0, 2400);
  const resumo =
    String(proposal.resumo_visual ?? "").trim() ||
    String(proposal.intent_summary ?? "").trim();
  const fraseImagem = String(proposal.frase_na_imagem ?? "").trim();
  const facts = collectMandatoryImageFacts(history, proposal);
  const produtos = (Array.isArray(proposal.midias_referenced) ? proposal.midias_referenced : [])
    .map((r) => String(r?.nome_exibicao ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const tom = String(identidade.tom_voz ?? "").trim() || "profissional e acessível";
  const publico = String(identidade.publico ?? "").trim() || "clientes da loja";
  const legendaRef = String(identidade.legenda_referencia ?? "").trim();
  const marca = ctx.nomeFantasia ? String(ctx.nomeFantasia).trim() : "";
  const revision = String(ctx.revisionInstructions || "").trim();
  const previousCaption = String(ctx.previousCaption || "").trim();

  const obrigatorio = [];
  if (facts.precos_promocao) {
    obrigatorio.push(`Preços que o cliente pediu (incluir na legenda): ${facts.precos_promocao}`);
  }
  if (facts.ocasiao) {
    obrigatorio.push(`Ocasião/tema: ${facts.ocasiao}`);
  }

  return `
Você é redator de Instagram para uma loja no Brasil.
Gere legenda + hashtags em português do Brasil. Retorne APENAS JSON válido.

Marca: ${marca || "não informada"}
Tom de voz: ${tom}
Público: ${publico}
${legendaRef ? `Referência de estilo de legenda da marca: ${legendaRef.slice(0, 600)}` : ""}

Pedido do cliente (histórico):
${pedido.slice(0, 2800)}

Direção da arte:
${resumo.slice(0, 900) || "(usar o pedido acima)"}
${fraseImagem ? `Texto já na imagem (não repetir inteiro na legenda): «${fraseImagem}»` : ""}
${produtos.length ? `Produtos no post: ${produtos.join(", ")}` : ""}
${obrigatorio.length ? `\nObrigatório respeitar:\n- ${obrigatorio.join("\n- ")}` : ""}
${previousCaption ? `\nLegenda anterior (revisar, não copiar igual):\n${previousCaption.slice(0, 1200)}` : ""}
${revision ? `\nAjustes pedidos pelo cliente:\n${revision.slice(0, 800)}` : ""}

Regras:
1) "legenda": texto pronto para colar no Instagram (máx. 900 caracteres), com gancho, benefício e CTA.
2) "hashtags": array com até ${limiteHashtags} hashtags relevantes (#minúsculas, sem espaços).
3) Complemente a imagem — não descreva pixel a pixel o que está na foto.
4) Se houver preço na imagem, a legenda pode reforçar a oferta sem copiar só números secos.
5) Não invente produtos que não foram citados no pedido ou na lista acima.
${revision ? "6) Aplique os ajustes pedidos pelo cliente mantendo tom da marca." : ""}
`.trim();
}

/**
 * @param {{
 *   history: Array<{ role: string, content: string }>,
 *   idEmpresa: string,
 *   db: import("@supabase/supabase-js").SupabaseClient,
 *   postContextProposal?: Record<string, unknown> | null,
 *   limiteHashtags?: number,
 *   revisionInstructions?: string | null,
 *   previousCaption?: string | null,
 * }} opts
 */
export async function generatePostCaption(opts) {
  const provider = resolveTextProvider();
  if (
    provider === "ollama" &&
    !(env.LLAMA_BASE_URL?.trim() || env.LLAMA_MODEL?.trim())
  ) {
    throw Object.assign(new Error("IA de texto não configurada (LLAMA_BASE_URL / LLAMA_MODEL)."), {
      status: 503,
    });
  }

  const { history, idEmpresa, db } = opts;
  const proposal =
    opts.postContextProposal && typeof opts.postContextProposal === "object"
      ? opts.postContextProposal
      : {};

  const contextoRows = await loadContextosEmpresaAtivos(db, idEmpresa);
  const { identidadeDados } = partitionContextosIdentidade(contextoRows);

  const { data: emp } = await db
    .from("empresa")
    .select("nome_fantasia")
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .maybeSingle();
  const nomeFantasia = String(emp?.nome_fantasia ?? "").trim() || null;

  const prompt = buildPostCaptionPrompt({
    history,
    proposal,
    identidadeDados,
    nomeFantasia,
    limiteHashtags: opts.limiteHashtags,
    revisionInstructions: opts.revisionInstructions,
    previousCaption: opts.previousCaption,
  });

  const result = await chatCompletionJson(prompt, { temperature: 0.75 });
  const legenda = String(result?.parsed?.legenda ?? result?.parsed?.copy ?? "").trim();
  const hashtags = Array.isArray(result?.parsed?.hashtags)
    ? result.parsed.hashtags
        .map((h) => {
          let t = String(h ?? "").trim();
          if (!t) return "";
          if (!t.startsWith("#")) t = `#${t.replace(/^#+/, "")}`;
          return t.replace(/\s+/g, "");
        })
        .filter(Boolean)
        .slice(0, opts.limiteHashtags ?? 12)
    : [];
  const model = result?.model || env.LLAMA_MODEL || DEFAULT_OLLAMA_CHAT_MODEL;

  if (!legenda) {
    await recordLlamaTextCall({
      ok: false,
      status: 502,
      inputTokens: result?.usage?.inputTokens,
      outputTokens: result?.usage?.outputTokens,
      totalTokens: result?.usage?.totalTokens,
      model,
    });
    throw Object.assign(new Error("Resposta incompleta do modelo (legenda vazia)."), {
      status: 502,
      parsed: result?.parsed,
    });
  }

  await recordLlamaTextCall({
    ok: true,
    status: 200,
    inputTokens: result?.usage?.inputTokens,
    outputTokens: result?.usage?.outputTokens,
    totalTokens: result?.usage?.totalTokens,
    model,
  });

  return { legenda, hashtags, model };
}
