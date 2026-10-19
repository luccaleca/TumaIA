import { buildMontagemResumo } from "./postContextProposalService.js";
import { formatProductDisplayName } from "./cadastroMeaningful.js";
import { nomeAproximadoDaCor } from "../modules/empresas/identidadeMarca.js";

/** Corta no fim de uma palavra, com reticências, em vez de no meio dela. */
export function cortarNoFimDaPalavra(texto, max) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max - 1);
  const ultimoEspaco = corte.lastIndexOf(" ");
  const base = ultimoEspaco >= Math.floor(max * 0.6) ? corte.slice(0, ultimoEspaco) : corte;
  return `${base.replace(/[\s,;:.\-–—]+$/, "")}…`;
}

const PRECO = /R\$\s?\d+(?:[.,]\d+)*/i;
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Como a arte vai ficar, em linhas curtas (mesmos dados do cartão do painel). O produto e o
 * texto da arte já têm linha própria na mensagem, então não se repetem aqui.
 *
 * @param {Record<string, unknown>} p proposta
 * @returns {string[]}
 */
export function descreverArteParaWhatsapp(p) {
  const brief = p.arte_brief && typeof p.arte_brief === "object" ? p.arte_brief : {};
  const linhas = [];

  const formato = brief.formato && typeof brief.formato === "object" ? brief.formato : null;
  if (formato?.ratio) {
    const forma =
      formato.orientation === "vertical" ? "vertical" : formato.orientation === "horizontal" ? "horizontal" : "quadrado";
    linhas.push(`Formato: ${formato.label || "Post"} ${forma} (${formato.ratio})`);
  }

  const fonteDoPreco = [p.intent_summary, brief.tema, brief.texto, p.frase_na_imagem]
    .filter((v) => typeof v === "string")
    .join(" ");
  const preco = fonteDoPreco.match(PRECO)?.[0];
  if (preco) linhas.push(`Preço: ${preco.replace(/R\$\s?/i, "R$ ")} em destaque`);

  const cores = (Array.isArray(brief.cores) ? brief.cores : []).filter((c) => HEX.test(String(c)));
  if (cores.length) {
    const doCliente = p.ajustes_do_cliente?.cores_alteradas === true;
    linhas.push(
      `${doCliente ? "Cores deste post" : "Cores da marca"}: ${cores
        .map((c) => {
          const nome = nomeAproximadoDaCor(c);
          return nome ? `${nome} (${c})` : c;
        })
        .join(", ")}`,
    );
  }

  const marca = p.identidade_resumo && typeof p.identidade_resumo === "object" ? p.identidade_resumo : {};
  const clima = typeof marca.estilo === "string" ? marca.estilo.trim() : "";
  if (clima) linhas.push(`Clima: ${cortarNoFimDaPalavra(clima, 140)}`);

  return linhas;
}

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

  const linhasDaArte = descreverArteParaWhatsapp(p);
  if (linhasDaArte.length) {
    parts.push("🎨 *Como vai ficar:*");
    for (const linha of linhasDaArte) parts.push(`• ${linha}`);
  } else {
    // Sem dados estruturados: um resumo curto. O «resumo visual» interno é para a IA, não para o cliente.
    const resumoVisual = typeof p.resumo_visual === "string" ? p.resumo_visual.trim() : "";
    const intent = typeof p.intent_summary === "string" ? p.intent_summary.trim() : "";
    const montagem = buildMontagemResumo(p);
    const cenaPedida = /cen[aá]rio pedido pelo cliente/i.test(resumoVisual)
      ? resumoVisual.replace(/^.*cen[aá]rio pedido pelo cliente:\s*/i, "").trim()
      : "";
    const cena =
      cenaPedida ||
      (montagem && montagem !== intent && !/^arte de lan[cç]amento/i.test(montagem) ? montagem : "") ||
      intent;
    if (cena) parts.push(`🎨 *Cena:* ${cortarNoFimDaPalavra(cena, 200)}`);
  }

  const frase = typeof p.frase_na_imagem === "string" ? p.frase_na_imagem.trim() : "";
  if (frase) parts.push(`✏️ *Texto na imagem:* ${cortarNoFimDaPalavra(frase, 80)}`);

  parts.push("");
  if (opts.briefingStatus === "collecting") {
    parts.push("_Falta algum detalhe — me diga o que ajustar antes de gerar._");
  } else {
    parts.push("_Quer mudar algo? Responda, uma linha por campo:_");
    parts.push("_*texto:* …   *cores:* azul e branco   *detalhes:* …_");
    parts.push("");
    parts.push("Está certo? Digite *gerar imagem* para criar a arte.");
  }

  return parts.join("\n");
}
