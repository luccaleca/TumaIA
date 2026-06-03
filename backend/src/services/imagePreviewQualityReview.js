import { z } from "zod";
import { env } from "../config.js";
import { llamaChatCompletionVisionJson } from "./llamaOpenAiClient.js";
import { fetchImageAsDataUrl } from "./llamaVisionImage.js";

const reviewSchema = z.object({
  approved: z.boolean(),
  score: z.coerce.number().min(0).max(100).optional().default(0),
  issues: z.array(z.string()).optional().default([]),
  summary: z.string().optional().default(""),
});

/** Problemas que impedem envio ao usuário mesmo com score alto. */
const BLOCKING_ISSUES = new Set([
  "produto_muito_grande",
  "texto_sobre_produto",
  "produto_cortado",
  "produto_fora_foco",
  "composicao_confusa",
  "produtos_sobrepostos",
  "logo_sobre_produto",
  "qualidade_baixa",
]);

const ISSUE_USER_LABELS = {
  produto_muito_grande: "produto(s) grande(s) demais",
  texto_sobre_produto: "texto da campanha em cima do produto",
  produto_cortado: "produto cortado na borda",
  produto_fora_foco: "produto principal sem destaque",
  composicao_confusa: "composição confusa",
  produtos_sobrepostos: "produtos ou elementos sobrepostos",
  logo_sobre_produto: "logo em cima do produto",
  qualidade_baixa: "qualidade visual insuficiente para post profissional",
  texto_ilegivel: "texto difícil de ler",
  muitos_elementos: "excesso de elementos competindo na mesma área",
};

/**
 * Revisão visual ligada quando há modelo de visão, salvo desligar no .env.
 */
export function isImagePreviewQualityReviewEnabled() {
  if (env.IMAGE_PREVIEW_QUALITY_REVIEW === false) return false;
  if (env.IMAGE_PREVIEW_QUALITY_REVIEW === true) return true;
  return Boolean(String(env.LLAMA_VISION_MODEL || env.IDENTIDADE_VISION_MODEL || "").trim());
}

export function imagePreviewQualityMinScore() {
  const n = Number(env.IMAGE_PREVIEW_QUALITY_MIN_SCORE);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 68;
}

/**
 * @param {unknown} raw
 */
export function normalizeQualityReviewResult(raw) {
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      approved: false,
      score: 0,
      issues: ["revisao_invalida"],
      summary: "A revisão automática não conseguiu avaliar a imagem.",
    };
  }
  const issues = parsed.data.issues
    .map((code) => String(code || "").trim().toLowerCase())
    .filter(Boolean);
  const minScore = imagePreviewQualityMinScore();
  const hasBlocking = issues.some((code) => BLOCKING_ISSUES.has(code));
  const approved =
    parsed.data.approved === true &&
    !hasBlocking &&
    (parsed.data.score ?? 0) >= minScore;

  return {
    approved,
    score: parsed.data.score ?? 0,
    issues,
    summary: String(parsed.data.summary || "").trim(),
    min_score: minScore,
    has_blocking_issues: hasBlocking,
  };
}

/**
 * @param {string[]} issues
 * @param {string} [summary]
 */
export function buildQualityRejectionUserMessage(issues, summary) {
  const codes = Array.isArray(issues) ? issues : [];
  const labels = codes
    .map((code) => ISSUE_USER_LABELS[code] || code.replace(/_/g, " "))
    .filter(Boolean);
  const intro =
    "A prévia foi barrada na revisão automática e não aparece no chat — a geração pode ter consumido crédito, mas esta imagem não foi entregue.";
  if (labels.length) {
    return `${intro} Motivos: ${labels.join("; ")}. Ajuste o pedido no chat ou o formato e tente gerar de novo.`;
  }
  const s = String(summary || "").trim();
  if (s) return `${intro} ${s}`;
  return `${intro} Tente simplificar o pedido (menos produtos, frase mais curta) e gere outra prévia.`;
}

/**
 * @param {string} imageUrl
 * @param {{
 *   productNames?: string[],
 *   heroProductName?: string | null,
 *   fraseNaImagem?: string | null,
 *   productCount?: number,
 *   composeProductAssets?: boolean,
 * }} [ctx]
 */
export async function reviewImagePreviewBeforeDelivery(imageUrl, ctx = {}) {
  const productNames = (ctx.productNames || []).map((n) => String(n || "").trim()).filter(Boolean);
  const hero = String(ctx.heroProductName || productNames[0] || "").trim();
  const frase = String(ctx.fraseNaImagem || "").trim();
  const productCount = Number(ctx.productCount) || productNames.length || 0;
  const collage = ctx.composeProductAssets === true;

  const prompt = `Você é revisor de arte promocional para Instagram (feed quadrado).
Analise a IMAGEM gerada e responda SOMENTE com um JSON válido (sem markdown).

Pedido esperado:
- produtos no acervo: ${productNames.length ? productNames.join(", ") : "nenhum ou cenário só"}
- produto principal (hero): ${hero || "não definido"}
- frase na imagem: ${frase || "nenhuma obrigatória"}
- quantidade de produtos esperada: ${productCount || "livre"}
- montagem por colagem automática: ${collage ? "sim (risco de sobreposição)" : "não (integrado no modelo)"}

Critérios para REPROVAR (approved=false) se notar na imagem:
- produto_muito_grande: embalagem ocupa área excessiva ou esmaga o layout
- texto_sobre_produto: tipografia/preço/frase cobrindo o produto
- produto_cortado: produto cortado nas bordas
- produto_fora_foco: hero pedido não é o destaque visual
- produtos_sobrepostos: dois produtos ou elementos importantes empilhados
- logo_sobre_produto: marca em cima do rótulo principal
- composicao_confusa: hierarquia visual ruim, poluído
- texto_ilegivel: texto borrado, minúsculo ou ilegível
- qualidade_baixa: aparência amadora, borrada ou não publicável

Se a arte estiver equilibrada, produtos legíveis, texto no lugar certo e pronta para feed, approved=true e score 75-100.

JSON:
{
  "approved": boolean,
  "score": number (0-100),
  "issues": string[] (códigos acima, vazio se ok),
  "summary": string (1 frase, português)
}`;

  const imageDataUrl = await fetchImageAsDataUrl(imageUrl);
  const visionModel = (env.IDENTIDADE_VISION_MODEL || env.LLAMA_VISION_MODEL || "llava:7b").trim();
  const { parsed, model } = await llamaChatCompletionVisionJson(prompt, [imageDataUrl], {
    model: visionModel,
    temperature: 0.05,
  });

  const review = normalizeQualityReviewResult(parsed);
  return {
    ...review,
    vision_model: model,
    reviewer: "ollama_vision",
  };
}
