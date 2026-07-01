import { buildMontagemResumo } from "./postContextProposalService.js";
import { formatProductDisplayName } from "./cadastroMeaningful.js";

/**
 * Mensagem de confirmação no WhatsApp com modelo, produtos e cena identificados.
 *
 * @param {Record<string, unknown> | null | undefined} proposal
 * @param {Array<{ kind?: string, label?: string }>} [links]
 * @param {{ briefingStatus?: string }} [opts]
 */
export function buildWhatsappPostConfirmation(proposal, links = [], opts = {}) {
  const p = proposal && typeof proposal === "object" ? proposal : {};
  const parts = ["*Confira se entendi certo:*"];

  const modelo =
    String(p.matched_contexto?.nome ?? "").trim() ||
    links.find((l) => l?.kind === "contexto")?.label?.trim() ||
    "";
  if (modelo) parts.push(`📋 *Modelo de post:* ${modelo}`);

  const produtoNames = [];
  const hero = p.hero_product && typeof p.hero_product === "object" ? p.hero_product : null;
  if (hero && typeof hero.nome_exibicao === "string" && hero.nome_exibicao.trim()) {
    produtoNames.push(formatProductDisplayName(hero.nome_exibicao.trim()));
  }
  for (const ref of Array.isArray(p.midias_referenced) ? p.midias_referenced : []) {
    if (!ref || typeof ref !== "object") continue;
    const n = formatProductDisplayName(String(ref.nome_exibicao ?? ref.nome_arquivo ?? "").trim());
    if (n && !produtoNames.includes(n)) produtoNames.push(n);
  }
  if (!produtoNames.length) {
    for (const l of links.filter((x) => x?.kind === "midia")) {
      const n = formatProductDisplayName(String(l.label ?? "").trim());
      if (n && !produtoNames.includes(n)) produtoNames.push(n);
    }
  }
  if (!produtoNames.length && Array.isArray(p.products_requested)) {
    for (const item of p.products_requested) {
      const n = String(item ?? "").trim();
      if (n && !produtoNames.includes(n)) produtoNames.push(n);
    }
  }
  if (produtoNames.length) {
    parts.push(`🛒 *Produto(s):* ${produtoNames.join(", ")}`);
  }

  const resumoVisual = typeof p.resumo_visual === "string" ? p.resumo_visual.trim() : "";
  const montagem = resumoVisual || buildMontagemResumo(p);
  const intent = typeof p.intent_summary === "string" ? p.intent_summary.trim() : "";
  const sceneFromResumo =
    resumoVisual && /cen[aá]rio pedido pelo cliente/i.test(resumoVisual)
      ? resumoVisual.replace(/^.*cen[aá]rio pedido pelo cliente:\s*/i, "").trim()
      : "";
  const cena =
    sceneFromResumo ||
    (montagem && montagem !== intent && !/^arte de lan[cç]amento/i.test(montagem) ? montagem : "") ||
    intent;
  if (cena) parts.push(`🎨 *Cena:* ${cena.slice(0, 300)}`);

  const frase = typeof p.frase_na_imagem === "string" ? p.frase_na_imagem.trim() : "";
  if (frase) parts.push(`✏️ *Texto na imagem:* ${frase.slice(0, 80)}`);

  parts.push("");
  if (opts.briefingStatus === "collecting") {
    parts.push("_Falta algum detalhe — me diga o que ajustar antes de gerar._");
  } else {
    parts.push("Está certo? Digite *gerar imagem* para criar a arte.");
  }

  return parts.join("\n");
}
