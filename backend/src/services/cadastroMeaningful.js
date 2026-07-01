/**
 * Valores de cadastro que não devem entrar no resumo visual (rótulos vazios ou placeholders).
 * @param {string} field
 * @param {string} value
 */
export function isMeaningfulCadastroValue(field, value) {
  const v = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!v || v.length < 3) return false;

  const generic = new Set([
    "categoria",
    "segmento",
    "publico-alvo",
    "publico alvo",
    "publico",
    "descreva",
    "sem segmento",
    "nome fantasia",
    "empresa",
    "item",
    "midia",
    "mídia",
  ]);
  if (generic.has(v)) return false;

  if (field === "segmento" && (v === "categoria" || v === "segmento")) return false;
  if (field === "publico" && /^publico[\s-]?alvo$/.test(v)) return false;

  return true;
}

/** @param {string} text */
export function isGenericMidiaWhy(text) {
  const t = String(text ?? "").trim();
  if (!t) return true;
  return /png do acervo (vinculado|selecionado)|refer[eê]ncia escolhida automaticamente/i.test(t);
}

/**
 * Nome legível do produto (sem extensão de arquivo).
 * @param {string} name
 */
export function formatProductDisplayName(name) {
  let s = String(name ?? "").trim();
  if (!s) return "";
  s = s.replace(/\.(png|jpe?g|webp|gif|jfif|svg)$/i, "").trim();
  s = s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return String(name ?? "").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * O pedido fala em promoção/preço — tem prioridade sobre o modelo (/lancamento, etc.).
 * @param {string} intent
 */
export function intentLooksPromotional(intent) {
  const t = String(intent ?? "").toLowerCase();
  return (
    /promo|promoção|promocao|desconto|oferta|black\s*friday|queima\s+de\s+estoque|liquida/i.test(t) ||
    /\d{1,4}[.,]\d{2}\s+por\s+\d{1,4}[.,]\d{2}/.test(t) ||
    /\d{1,3}\s*,\d{2}\s+por\s+\d/.test(t) ||
    /de\s+r\$\s*\d/.test(t) ||
    /\d+\s+por\s+\d+/.test(t)
  );
}

/**
 * O que o cliente pediu no chat (não confundir com modelo /lancamento escolhido no menu).
 * @param {string} intent
 * @returns {string[]}
 */
export function extractPedidoCampanhaLabels(intent) {
  const t = String(intent ?? "").toLowerCase();
  const labels = [];
  if (/queima\s+de\s+estoque|liquida[cç][aã]o/i.test(t)) labels.push("Queima de estoque");
  if (/promo|promoção|promocao|desconto|oferta/i.test(t) || intentLooksPromotional(intent)) {
    labels.push("Promoção");
  }
  if (/lancamento|lançamento/i.test(t) && !labels.length) labels.push("Lançamento");
  return [...new Set(labels)];
}

/**
 * Pedido fala em lançamento/novidade — só quando não é promoção.
 * @param {string} intent
 */
export function intentLooksLaunch(intent) {
  const t = String(intent ?? "").toLowerCase();
  if (intentLooksPromotional(intent)) return false;
  return /lancamento|lançamento|novidade|novo produto|chegou agora|estreia|novo sabor/i.test(t);
}

/**
 * Modelo de post preferido a partir do pedido (slug do catálogo).
 * @param {string} intent
 * @returns {"promocao" | "lancamento" | "produto" | "mensagens" | null}
 */
export function inferPreferredPlaybookSlug(intent) {
  const t = String(intent ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const postModelMatch = t.match(
    /modelo\s+(?:de\s+)?post\s+(?:de\s+)?(produto|promo[cç]ao|lancamento|mensagens?)|post\s+com\s+modelo\s+(?:de\s+)?post\s+(?:de\s+)?(produto|promo[cç]ao|lancamento|mensagens?)/,
  );
  const postKind = postModelMatch?.[1] || postModelMatch?.[2];
  if (postKind) {
    if (/promo/.test(postKind)) return "promocao";
    if (/lanc/.test(postKind)) return "lancamento";
    if (/mensagem/.test(postKind)) return "mensagens";
    return "produto";
  }

  if (
    /modelo\s+de\s+produto|\bpost(agem)?\s+(no\s+)?modelo\s+produto\b|\bno\s+modelo\s+de\s+produto\b|\bmodelo\s+produto\b/.test(
      t,
    )
  ) {
    return "produto";
  }
  if (/modelo\s+de\s+promo/.test(t)) return "promocao";
  if (/modelo\s+de\s+lan[cç]amento/.test(t)) return "lancamento";
  if (/modelo\s+de\s+mensagem/.test(t)) return "mensagens";
  if (intentLooksPromotional(intent)) return "promocao";
  if (intentLooksLaunch(intent)) return "lancamento";
  if (/institucional|nossa marca|sobre a empresa|mensagem da marca/i.test(t)) return "mensagens";
  if (/no dia a dia|em uso|rotina|mostra o produto/i.test(t)) return "produto";
  return null;
}
