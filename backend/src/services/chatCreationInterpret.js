/**
 * Interpretação genérica da sessão de criação.
 * Produto é um componente; o briefing (ação, tema, oferta, estilo…) é o restante.
 * Categorias — não regras por frase específica.
 */

/** @typedef {{
 *   produto: string,
 *   intencao: string,
 *   tema: string,
 *   oferta: string,
 *   estilo: string,
 *   destaque: string,
 *   sabor: string,
 *   cenario: string,
 *   caracteristica: string,
 *   composicao: string,
 * }} CreationState */

/** @typedef {ReturnType<typeof parseCreationTurn>} CreationTurn */

const VISUAL_STYLE_TERMS = new Set([
  "photorealistic",
  "fotorealista",
  "fotorealismo",
  "realistic",
  "realista",
  "realistas",
  "minimal",
  "minimalista",
  "minimalistas",
  "clean",
  "limpo",
  "limpa",
  "premium",
  "luxury",
  "luxo",
  "editorial",
  "lifestyle",
  "hero",
  "showcase",
  "cinematic",
  "cinematografico",
  "cinematografica",
  "studio",
  "estudio",
  "3d",
  "dramatic",
  "dramatico",
  "dramatica",
  "natural",
  "commercial",
  "comercial",
  "catalog",
  "catalogo",
  "elegante",
  "moderno",
  "moderna",
  "profissional",
  "chamativo",
  "chamativa",
  "bonito",
  "bonita",
  "escuro",
  "escura",
  "claro",
  "clara",
  "neon",
  "gradiente",
  "fundo",
  "background",
  "visual",
  "estilo",
  "estilos",
  "mood",
  "atmosferico",
  "atmosferica",
  "estetico",
  "estetica",
]);

/** Tokens que nunca são nome de produto na busca do acervo. */
const NON_PRODUCT_CONTEXT_TERMS = new Set([
  "natal",
  "halloween",
  "hallowen",
  "pascoa",
  "carnaval",
  "ano",
  "novo",
  "black",
  "friday",
  "verao",
  "inverno",
  "outono",
  "primavera",
  "dia",
  "maes",
  "pais",
  "namorados",
  "academia",
  "academias",
  "treino",
  "fitness",
  "festa",
  "junina",
  "junino",
  "praia",
  "mar",
  "neve",
  "sabor",
  "sabores",
  "tema",
  "tematica",
  "tematicas",
  "cenario",
  "ambientacao",
]);

/** Temas conhecidos (rótulo de exibição). Padrões abertos complementam. */
const THEME_LABELS = [
  [/\bfesta\s+junina\b|\bjunina\b|\bjunino\b/, "Festa Junina"],
  [/\bnatal\b/, "Natal"],
  [/\bhalloween|hallowen\b/, "Halloween"],
  [/\bpascoa\b/, "Páscoa"],
  [/\bblack\s*friday\b/, "Black Friday"],
  [/\bcarnaval\b/, "Carnaval"],
  [/\bano\s+novo\b/, "Ano Novo"],
  [/\bdia\s+das?\s+maes\b/, "Dia das Mães"],
  [/\bdia\s+dos?\s+pais\b/, "Dia dos Pais"],
  [/\bverao\b/, "Verão"],
  [/\binverno\b/, "Inverno"],
  [/\boutono\b/, "Outono"],
  [/\bprimavera\b/, "Primavera"],
];

const INTENT_MAP = [
  [/\b(promo[cç][aã]o|promo\b|desconto|oferta)\b/i, "promocao"],
  [/\b(lancamento|novidade|estreia|lancar|lan[cç]ar)\b/i, "lancamento"],
  [/\b(anunciar|anuncio|divulga[cç][aã]o|divulgar|apresenta[cç][aã]o|apresentar)\b/i, "divulgacao"],
  [/\b(campanha)\b/i, "campanha"],
  [/\b(destaque)\b/i, "destaque"],
];

const SCENARIO_WORDS = [
  ["praia", "praia"],
  ["academia", "academia"],
  ["estudio", "estúdio"],
  ["studio", "estúdio"],
  ["cozinha", "cozinha"],
  ["mesa", "mesa"],
  ["rua", "rua"],
  ["parque", "parque"],
  ["ginasio", "ginásio"],
  ["natureza", "natureza"],
];

const REVISION_ONLY_RE =
  /^(faz(er)?|deixa|coloca|troca|muda|agora|quero|mais|bem|bem\s+mais|outra?\s+vers[aã]o|faz\s+outra|volta|usa\s+esse|esse\s+mais|pre[cç]o\s+(maior|menor|grande|em\s+evid)|pre[cç]os?\s+(bem\s+)?grandes?|fundo\s+de|estilo\s+|tema\s+|cenario\s+)/i;

/**
 * @param {string} text
 */
export function normalizeCreationText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} token
 */
export function isVisualStyleTerm(token) {
  const t = normalizeCreationText(token).replace(/[^a-z0-9]/g, "");
  if (!t) return false;
  if (VISUAL_STYLE_TERMS.has(t)) return true;
  if (/^(photo|foto)?realist/.test(t)) return true;
  if (/^minimal/.test(t)) return true;
  if (/^premium$/.test(t) || /^estetic/.test(t)) return true;
  return false;
}

/**
 * @param {string} token
 */
export function isThemeNoiseTerm(token) {
  const t = normalizeCreationText(token).replace(/[^a-z0-9]/g, "");
  return NON_PRODUCT_CONTEXT_TERMS.has(t);
}

/**
 * @param {string} raw
 */
export function titleCasePt(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Remove atributos de briefing — deixa só candidatos a produto para o acervo.
 * @param {string} raw
 */
export function stripCreationNoiseForProductSearch(raw) {
  let s = normalizeCreationText(raw);
  s = s.replace(
    /\/([^\s/]+?)\.(?:png|jpe?g|webp|gif|avif|bmp|svg)(?:--[0-9a-f-]{6,})?/gi,
    (_, name) => ` ${String(name).replace(/[-_]+/g, " ")} `,
  );
  s = s.replace(/(^|\s)\/([a-z0-9][\w-]{1,40})\b/gi, (_, sp, name) => `${sp}${name} `);
  s = s.replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){1,4}[0-9a-f]*\b/gi, " ");
  s = s.replace(/\b(\d+)\s*(?:por|p\/|x|é|eh|=)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\b/gi, " ");
  s = s.replace(/\b(?:r\$\s*)?\d+(?:[.,]\d{1,2})?\b/g, " ");
  s = s.replace(/\b\d+\s*g\s+de\s+\w+/gi, " ");
  s = s.replace(
    /\b(monta|montar|cria|criar|gera|gerar|preciso|precisa|quero|faz|fazer|deixa|deixe|coloca|troca|muda|agora|foto|fotos|arte|post|banner|valor|preco|precos|promocao|promocoes|promo|campanha|oferta|desconto|estilo|estetica|visual|fundo|background|algo|uma|umas|uns|um|evidencia|destaque|grandes?|maior|aparentes?|tematica|tematicas|tema|cima|produto|produtos|sabor|sabores|lancamento|lancar|divulgar|divulgacao|anunciar|anuncio|versao|realista|premium|clean|inverno|verao|praia|academia|festa|junina)\b/gi,
    " ",
  );

  const kept = [];
  for (const token of s.split(/[^a-z0-9]+/).filter(Boolean)) {
    const n = normalizeCreationText(token);
    if (n.length < 2) continue;
    if (isVisualStyleTerm(n) || isThemeNoiseTerm(n)) continue;
    if (/^\d+$/.test(n)) continue;
    if (/^(de|do|da|dos|das|com|por|pra|para|e|ou|a|o|as|os|cao|acao|mais|bem)$/.test(n)) continue;
    kept.push(n);
  }
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * @param {string} raw
 */
export function looksLikeProductCandidate(raw) {
  const n = normalizeCreationText(raw);
  if (!n || n.length < 3) return false;
  if (isVisualStyleTerm(n) || isThemeNoiseTerm(n)) return false;
  if (/^(uma|um|uns|umas|de|do|da|cao|acao|algo|isso|esse|essa)\b/.test(n)) return false;
  const words = n.split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  if (words.every((w) => w.length <= 2 || ["de", "do", "da", "com", "por"].includes(w))) {
    return false;
  }
  return true;
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function extractSlashProductCommands(raw) {
  const text = String(raw || "");
  const out = [];
  const reFile =
    /\/([^\s/]+?)\.(?:png|jpe?g|webp|gif|avif|bmp|svg)(?:--[0-9a-f-]{6,})?/gi;
  let m;
  while ((m = reFile.exec(text))) {
    const name = String(m[1] || "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (name && !isVisualStyleTerm(name)) out.push(name);
  }
  const reCmd = /(^|\s)\/([a-z0-9][\w-]{1,40})\b/gi;
  while ((m = reCmd.exec(text))) {
    const name = String(m[2] || "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (name && !isVisualStyleTerm(name)) out.push(name);
  }
  return [...new Set(out.map((x) => x.trim()).filter(Boolean))];
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function extractStyleTermsFromText(raw) {
  const n = normalizeCreationText(raw);
  if (!n) return [];
  const hits = [];
  for (const term of VISUAL_STYLE_TERMS) {
    if (term.length < 3) continue;
    if (term === "fundo" || term === "background" || term === "estilo" || term === "visual") continue;
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(n)) hits.push(term);
  }
  if (/\bestetica\b/.test(n) && /\b(premium|clean|realista|minimal)/.test(n)) {
    for (const s of ["premium", "clean", "realista", "minimal"]) {
      if (n.includes(s) && !hits.includes(s)) hits.push(s);
    }
  }
  if (/\b(photo|foto)?\s*realist/i.test(n) && !hits.some((h) => /realist/.test(h))) {
    hits.push("photorealistic");
  }
  if (/\bmais\s+real\b/.test(n) && !hits.includes("realista")) hits.push("realista");
  if (/\bmais\s+(bonito|profissional|premium|clean)\b/.test(n)) {
    const m = n.match(/\bmais\s+(bonito|profissional|premium|clean)\b/);
    if (m?.[1] && !hits.includes(m[1])) hits.push(m[1]);
  }
  return hits;
}

/**
 * Tema por categoria (rótulos conhecidos + «tema X» aberto).
 * @param {string} raw
 */
export function extractThemeFromText(raw) {
  const n = normalizeCreationText(raw);
  if (!n) return "";

  for (const [re, label] of THEME_LABELS) {
    if (re.test(n)) return label;
  }

  const temaExplicit = n.match(
    /\btema(?:tica)?\s+(?:de\s+|do\s+|da\s+|com\s+)?([a-z0-9][a-z0-9\s-]{1,40})/,
  );
  if (temaExplicit?.[1]) {
    let chunk = temaExplicit[1]
      .replace(/\b(em\s+cima|acima|do\s+produto|da\s+arte|com|e|os|as|precos?).*$/, "")
      .trim();
    chunk = chunk
      .split(/\s+/)
      .filter((w) => !isVisualStyleTerm(w) && !/^(de|do|da|com)$/.test(w))
      .slice(0, 4)
      .join(" ");
    if (chunk.length >= 3) return titleCasePt(chunk);
  }

  return "";
}

/**
 * @param {string} raw
 */
export function extractOfferFromText(raw) {
  // Dimensões (1080x1080, 1920×1080) não são oferta "N por R$N".
  const t = String(raw || "").replace(/\b\d{3,4}\s*[x×]\s*\d{3,4}\b/gi, " ");
  const multi = t.match(
    /(\d+)\s*(?:por|p\/|x)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?).{0,40}?(\d+)\s*(?:por|p\/|x)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i,
  );
  if (multi) {
    return `${multi[1]} por R$${multi[2]} / ${multi[3]} por R$${multi[4]}`
      .replace(/R\$\s*/g, "R$")
      .slice(0, 120);
  }
  const ePairs = [...t.matchAll(/(\d+)\s*(?:é|eh|=)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/gi)];
  if (ePairs.length >= 2) {
    return `${ePairs[0][1]} por R$${ePairs[0][2]} / ${ePairs[1][1]} por R$${ePairs[1][2]}`
      .replace(/R\$\s*/g, "R$")
      .slice(0, 120);
  }
  if (ePairs.length === 1) {
    return `${ePairs[0][1]} por R$${ePairs[0][2]}`.replace(/R\$\s*/g, "R$").slice(0, 80);
  }
  const single = t.match(/\b(\d+)\s*(?:por|p\/|x)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\b/i);
  if (single) {
    return `${single[1]} por R$${single[2]}`.replace(/R\$\s*/g, "R$").slice(0, 80);
  }
  const pct = t.match(/\b(\d{1,2})\s*%\s*(?:de\s+)?(?:off|desconto)?\b/i);
  if (pct) return `${pct[1]}% de desconto`;
  const fromTo = t.match(
    /\b(?:de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:para|por|pra)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\b/i,
  );
  if (fromTo) return `de R$${fromTo[1]} por R$${fromTo[2]}`;
  return "";
}

/**
 * @param {string} raw
 */
export function extractFlavorFromText(raw) {
  const n = normalizeCreationText(raw);
  if (!n) return "";
  const m = n.match(/\bsabor(?:es)?\s+(?:de\s+|da\s+|do\s+)?([a-z0-9][a-z0-9\s-]{1,40})/);
  if (!m?.[1]) return "";
  let chunk = m[1]
    .replace(/\b(com|tema|estilo|promo|campanha|lancamento|e|de).*$/, "")
    .trim();
  chunk = chunk
    .split(/\s+/)
    .filter((w) => !isVisualStyleTerm(w) && !/^(de|do|da|com)$/.test(w))
    .slice(0, 3)
    .join(" ");
  if (chunk.length < 2) return "";
  if (isVisualStyleTerm(chunk)) return "";
  return titleCasePt(chunk);
}

/**
 * @param {string} raw
 */
export function extractScenarioFromText(raw) {
  const n = normalizeCreationText(raw);
  if (!n) return "";
  const fundo = n.match(/\bfundo\s+(?:de\s+|da\s+|do\s+|com\s+)?([a-z0-9][a-z0-9\s-]{1,30})/);
  if (fundo?.[1]) {
    const chunk = fundo[1]
      .split(/\s+/)
      .filter((w) => !/^(de|do|da|com|e)$/.test(w))
      .slice(0, 3)
      .join(" ");
    if (chunk.length >= 3) return titleCasePt(chunk);
  }
  if (/\bao\s+fundo\b/.test(n)) {
    for (const [token, label] of SCENARIO_WORDS) {
      if (n.includes(token)) return label;
    }
  }
  for (const [token, label] of SCENARIO_WORDS) {
    if (new RegExp(`\\b${token}\\b`).test(n)) return label;
  }
  return "";
}

/**
 * Ex.: 15g de proteína
 * @param {string} raw
 */
export function extractCharacteristicFromText(raw) {
  const n = normalizeCreationText(raw);
  if (!n) return "";
  const grams = n.match(/\b(\d+)\s*g\s+de\s+([a-z][a-z0-9\s-]{1,30})/);
  if (grams) {
    const what = grams[2]
      .split(/\s+/)
      .filter((w) => !/^(de|do|da|com|e)$/.test(w))
      .slice(0, 3)
      .join(" ");
    if (what) return `${grams[1]}g de ${what}`;
  }
  const ml = n.match(/\b(\d+)\s*(ml|l|kg)\b/);
  if (ml && /\b(destaque|destaca|tem|com)\b/.test(n)) {
    return `${ml[1]}${ml[2]}`;
  }
  return "";
}

/**
 * @param {string} raw
 */
export function extractLayoutEmphasis(raw) {
  const n = normalizeCreationText(raw);
  if (!n) return "";
  const bits = [];
  if (/\btematica\b/.test(n) && /\b(em\s+cima|acima|sobre|em\s+torno|ao\s+redor)\b/.test(n)) {
    bits.push("temática em cima do produto");
  }
  if (
    /\bprecos?\b/.test(n) &&
    /\b(aparent|evidenci|destaque|grandes?|maior|visiv|bem\s+aparent)/.test(n)
  ) {
    bits.push("preços em destaque");
  } else if (/\bpreco\s+(maior|grande|em\s+evid)/.test(n)) {
    bits.push("preço em destaque");
  }
  if (/\bdestaca\s+que\b/.test(n) || /\bem\s+destaque\b/.test(n)) {
    const char = extractCharacteristicFromText(raw);
    if (char) bits.push(`destacar ${char}`);
  }
  if (/\btroca\s+o\s+fundo\b/.test(n)) bits.push("trocar fundo");
  return bits.join("; ").slice(0, 160);
}

/**
 * @param {string} raw
 */
export function extractCompositionFromText(raw) {
  const n = normalizeCreationText(raw);
  if (!n) return "";
  const bits = [];
  if (/\b(em\s+cima|acima)\s+(do|da)\s+produto\b/.test(n)) {
    bits.push("elementos acima do produto");
  }
  if (/\bao\s+fundo\b/.test(n) || /\bfundo\s+de\b/.test(n)) {
    const sc = extractScenarioFromText(raw);
    if (sc) bits.push(`fundo: ${sc}`);
  }
  return bits.join("; ").slice(0, 160);
}

/**
 * @param {string} raw
 */
export function extractIntentFromText(raw) {
  const n = normalizeCreationText(raw);
  for (const [re, intent] of INTENT_MAP) {
    if (re.test(n)) return intent;
  }
  if (/\b(preciso|quero)\s+de\s+(uma\s+)?(foto|arte|imagem)\b/.test(n)) return "arte";
  if (/\b(foto|arte|imagem)\s+do\s+produto\b/.test(n)) return "arte";
  return "";
}

/**
 * @param {string} raw
 */
export function extractExplicitProductHints(raw) {
  const slash = extractSlashProductCommands(raw);
  const n = normalizeCreationText(raw);
  const hints = [...slash];

  const patterns = [
    /\b(?:troca|mud[ae]|substitu)\s+(?:para|pra|por)\s+([a-z0-9][a-z0-9\s-]{1,40})/i,
    /\bproduto\s+(?!photoreal|realistic|premium|clean|minimal|luxury)([a-z0-9][a-z0-9\s-]{1,40})/i,
    /\b(?:do|da|dos|das)\s+([a-z0-9][a-z0-9\s-]{1,40})(?:\s*,|\s+com|\s+estilo|\s+sabor|\s+tema|\s+photoreal|\s*$)/i,
    /\b(?:usa|usar|selecion)\s+(?:o\s+|a\s+|esse\s+|essa\s+)?([a-z0-9][a-z0-9\s-]{1,40})/i,
  ];
  for (const re of patterns) {
    const m = String(raw || "").match(re);
    if (!m?.[1]) continue;
    const cleaned = stripCreationNoiseForProductSearch(m[1]);
    if (cleaned && looksLikeProductCandidate(cleaned)) hints.push(cleaned);
  }

  if (!hints.length) {
    const only = stripCreationNoiseForProductSearch(raw);
    const words = only.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 4) {
      const joined = words.join(" ");
      if (
        looksLikeProductCandidate(joined) &&
        !extractIntentFromText(raw) &&
        !extractOfferFromText(raw) &&
        !extractStyleTermsFromText(raw).length &&
        !extractThemeFromText(raw) &&
        !extractFlavorFromText(raw) &&
        !/\b(quero|faz|deixa|monta|promo|post|arte|tema|sabor)\b/i.test(n)
      ) {
        hints.push(joined);
      }
    }
  }

  return [...new Set(hints.map((h) => h.trim()).filter((h) => h.length >= 2))];
}

/**
 * Atributos de briefing além de ação/produto (tema, oferta, visual…).
 * Intenção sozinha não basta — evita engolir «promo da linha X» no catálogo.
 * @param {CreationTurn | CreationState | Record<string, unknown>} turn
 */
export function hasCreativeBriefingExtras(turn) {
  if (!turn || typeof turn !== "object") return false;
  const t = /** @type {Record<string, unknown>} */ (turn);
  if (t.theme || t.tema) return true;
  if (t.offer || t.oferta) return true;
  if (Array.isArray(t.style) ? t.style.length : t.estilo) return true;
  if (t.layout || t.destaque) return true;
  if (t.flavor || t.sabor) return true;
  if (t.scenario || t.cenario) return true;
  if (t.characteristic || t.caracteristica) return true;
  if (t.composition || t.composicao) return true;
  return false;
}

/**
 * Algum atributo de briefing (inclui ação).
 * @param {CreationTurn | CreationState | Record<string, unknown>} turn
 */
export function hasCreationAttributes(turn) {
  if (!turn || typeof turn !== "object") return false;
  const t = /** @type {Record<string, unknown>} */ (turn);
  if (t.intent || t.intencao) return true;
  return hasCreativeBriefingExtras(turn);
}

/**
 * Pedido de listagem/filtro de catálogo (não criação de uma arte).
 * @param {string} question
 */
export function isCatalogListingRequest(question) {
  const n = normalizeCreationText(question);
  if (!n) return false;
  if (/\b(quais|que)\s+produtos?\b/.test(n)) return true;
  if (/\blista\s+(de\s+)?produtos?\b/.test(n)) return true;
  if (/\bo\s+que\s+temos\b/.test(n)) return true;
  if (/\btodos\s+(os\s+)?produtos?\b/.test(n)) return true;
  if (/\bprodutos?\s+que\s+(tem|temos|contem)\b/.test(n)) return true;
  if (/\bentram\s+na\s+(promo|campanha)\b/.test(n)) return true;
  if (/\btudo\s+que\s+tem\b/.test(n)) return true;
  if (/\bno\s+nome\b/.test(n) && /\b(whey|produto|item)\b/.test(n)) return true;
  // «campanha/promo dos X» = filtrar linha no acervo, não arte única.
  if (/\b(campanha|promo[cç][aã]o|promo)\s+dos\b/.test(n)) return true;
  if (/\blinha\s+(de\s+)?[a-z]/.test(n) && /\b(campanha|promo|divulgar|post)\b/.test(n)) return true;
  return false;
}

/**
 * @param {string} raw
 */
export function isBareProductSelection(raw) {
  const t = String(raw || "").trim();
  if (!t) return false;
  const turn = {
    slash: extractSlashProductCommands(t),
    styles: extractStyleTermsFromText(t),
    offer: extractOfferFromText(t),
    intent: extractIntentFromText(t),
    theme: extractThemeFromText(t),
    layout: extractLayoutEmphasis(t),
    flavor: extractFlavorFromText(t),
    scenario: extractScenarioFromText(t),
    characteristic: extractCharacteristicFromText(t),
  };
  if (
    turn.styles.length ||
    turn.offer ||
    turn.intent ||
    turn.theme ||
    turn.layout ||
    turn.flavor ||
    turn.scenario ||
    turn.characteristic
  ) {
    return false;
  }
  if (turn.slash.length && stripCreationNoiseForProductSearch(t).split(/\s+/).length <= 4) {
    return true;
  }
  const productOnly = stripCreationNoiseForProductSearch(t);
  return Boolean(productOnly) && productOnly.split(/\s+/).length <= 3 && t.length < 48;
}

/**
 * @param {string} raw
 */
export function isCreationRevisionOnly(raw) {
  const t = String(raw || "").trim();
  if (!t) return false;
  if (extractSlashProductCommands(t).length) return false;
  if (isCatalogListingRequest(t)) return false;
  if (/\b(tem|temos|existe)\s+[a-z]{3,}/i.test(t) && !extractStyleTermsFromText(t).length) {
    return false;
  }

  const styles = extractStyleTermsFromText(t);
  const offer = extractOfferFromText(t);
  const theme = extractThemeFromText(t);
  const layout = extractLayoutEmphasis(t);
  const flavor = extractFlavorFromText(t);
  const scenario = extractScenarioFromText(t);
  const characteristic = extractCharacteristicFromText(t);
  const productHints = extractExplicitProductHints(t).filter(looksLikeProductCandidate);
  const n = normalizeCreationText(t);

  if (/\b(faz\s+outra|outra\s+vers[aã]o|nova\s+vers[aã]o)\b/.test(n)) return true;
  if (/\b(agora|mais|bem)\s+(premium|clean|realista|profissional|bonito)/.test(n)) return true;
  if (/\bmuda\s+o\s+tema\b|\bcoloca\s+mais\s+elementos\b|\btroca\s+o\s+fundo\b/.test(n)) {
    return true;
  }
  if (REVISION_ONLY_RE.test(t) && !productHints.length) return true;

  const hasDirective = Boolean(
    styles.length || offer || theme || layout || flavor || scenario || characteristic,
  );
  if (hasDirective && !productHints.length) return true;
  if (styles.length && stripCreationNoiseForProductSearch(t).length < 2) return true;
  return false;
}

/**
 * @param {string} raw
 */
export function parseCreationTurn(raw) {
  const text = String(raw || "").trim();
  const slashProducts = extractSlashProductCommands(text);
  const styles = extractStyleTermsFromText(text);
  const productHints = extractExplicitProductHints(text).filter(looksLikeProductCandidate);
  const fromStrip = stripCreationNoiseForProductSearch(text);
  const productQuery =
    slashProducts.find(looksLikeProductCandidate) ||
    productHints[0] ||
    (looksLikeProductCandidate(fromStrip) ? fromStrip : "") ||
    "";

  const cleanQuery = String(productQuery || "")
    .split(/\s+/)
    .filter((w) => !isVisualStyleTerm(w) && !isThemeNoiseTerm(w))
    .join(" ")
    .trim();

  const revisionOnly = isCreationRevisionOnly(text);
  const intent = extractIntentFromText(text);
  const theme = extractThemeFromText(text);
  const offer = extractOfferFromText(text);
  const layout = extractLayoutEmphasis(text);
  const flavor = extractFlavorFromText(text);
  const scenario = extractScenarioFromText(text);
  const characteristic = extractCharacteristicFromText(text);
  const composition = extractCompositionFromText(text);

  return {
    slashProducts,
    productHints,
    productQuery: cleanQuery && looksLikeProductCandidate(cleanQuery) ? cleanQuery : null,
    intent,
    theme,
    offer,
    style: styles,
    layout,
    flavor,
    scenario,
    characteristic,
    composition,
    isRevisionOnly: revisionOnly,
    isBareSelection: isBareProductSelection(text),
    needsAcervoLookup: Boolean(
      cleanQuery &&
        looksLikeProductCandidate(cleanQuery) &&
        !revisionOnly &&
        (slashProducts.length ||
          productHints.length ||
          /\b(produto|tem|temos|promo|lancamento|campanha|monta|post)\b/i.test(text)),
    ),
  };
}

/** @returns {CreationState} */
export function emptyCreationState() {
  return {
    produto: "",
    intencao: "",
    tema: "",
    oferta: "",
    estilo: "",
    destaque: "",
    sabor: "",
    cenario: "",
    caracteristica: "",
    composicao: "",
  };
}

/**
 * @param {CreationState} prev
 * @param {CreationTurn} turn
 * @returns {CreationState}
 */
export function mergeCreationState(prev, turn) {
  const base = { ...emptyCreationState(), ...(prev || {}) };
  const next = { ...base };
  const incoming =
    (turn.slashProducts || []).find(looksLikeProductCandidate) ||
    (turn.productHints || []).find(looksLikeProductCandidate) ||
    (!turn.isRevisionOnly && turn.productQuery && looksLikeProductCandidate(turn.productQuery)
      ? turn.productQuery
      : "");
  if (incoming) next.produto = incoming;
  if (turn.intent) next.intencao = turn.intent;
  if (turn.theme) next.tema = turn.theme;
  if (turn.offer) next.oferta = turn.offer;
  if (turn.style?.length) next.estilo = turn.style.join(", ");
  if (turn.layout) next.destaque = turn.layout;
  if (turn.flavor) next.sabor = turn.flavor;
  if (turn.scenario) next.cenario = turn.scenario;
  if (turn.characteristic) next.caracteristica = turn.characteristic;
  if (turn.composition) next.composicao = turn.composition;
  return next;
}

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @param {string} [currentQuestion]
 * @returns {CreationState}
 */
export function deriveCreationStateFromHistory(history, currentQuestion = "") {
  let state = emptyCreationState();
  const msgs = Array.isArray(history) ? history : [];
  for (const m of msgs) {
    if (m?.role !== "user") continue;
    const t = String(m.content || "").trim();
    if (!t) continue;
    state = mergeCreationState(state, parseCreationTurn(t));
  }
  if (currentQuestion) {
    state = mergeCreationState(state, parseCreationTurn(currentQuestion));
  }
  return state;
}

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @param {{ question?: string }} [opts]
 */
export function composeCreationPedidoHint(history, opts = {}) {
  const question = typeof opts.question === "string" ? opts.question.trim() : "";
  const state = deriveCreationStateFromHistory(history, question);
  const parts = [];
  if (state.produto) parts.push(state.produto);
  if (state.intencao) parts.push(state.intencao);
  if (state.sabor) parts.push(`sabor ${state.sabor}`);
  if (state.tema) parts.push(state.tema);
  if (state.oferta) parts.push(state.oferta);
  if (state.estilo) parts.push(`estilo ${state.estilo}`);
  if (state.cenario) parts.push(`cenário ${state.cenario}`);
  if (state.caracteristica) parts.push(state.caracteristica);
  if (state.destaque) parts.push(state.destaque);
  if (state.composicao) parts.push(state.composicao);
  if (parts.length) return parts.join(" · ").slice(0, 2000);
  if (question && !isCreationRevisionOnly(question)) return question.slice(0, 2000);
  return "";
}

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @param {string} [currentQuestion]
 */
export function hasActiveCreationContext(history, currentQuestion = "") {
  const state = deriveCreationStateFromHistory(history, currentQuestion);
  return Boolean(state.produto || hasCreationAttributes(state));
}

/**
 * Produto (mensagem ou sessão) + qualquer atributo de briefing.
 * @param {string} question
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function hasRichCreationBrief(question, history = []) {
  const state = deriveCreationStateFromHistory(history, question);
  const turn = parseCreationTurn(question);
  const hasProduct = Boolean(state.produto || turn.productQuery || turn.slashProducts.length);
  if (!hasProduct) return false;
  return hasCreativeBriefingExtras(state) || hasCreativeBriefingExtras(turn);
}

/**
 * Briefing de criação vence dump de catálogo — por atributos, não por frase.
 * @param {string} question
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function shouldPreferImageBriefingOverAcervo(question, history = []) {
  const q = String(question || "").trim();
  if (!q) return false;
  if (isCatalogListingRequest(q)) return false;
  return hasRichCreationBrief(q, history);
}

/**
 * @param {CreationState} state
 * @param {string} [productLabel]
 */
export function formatCreationBriefAck(state, productLabel = "") {
  const produto = String(productLabel || state?.produto || "produto").trim();
  const parts = [`Beleza — ${produto}`];
  if (state?.intencao) parts.push(state.intencao);
  if (state?.sabor) parts.push(`sabor ${state.sabor}`);
  if (state?.tema) parts.push(`tema ${state.tema}`);
  if (state?.oferta) parts.push(state.oferta);
  if (state?.estilo) parts.push(`estilo ${state.estilo}`);
  if (state?.cenario) parts.push(`cenário ${state.cenario}`);
  if (state?.caracteristica) parts.push(state.caracteristica);
  if (state?.destaque) parts.push(state.destaque);
  if (state?.composicao) parts.push(state.composicao);
  return (
    `${parts.join(" · ")}. ` +
    "Vou montar o resumo da arte no painel com isso — confira e confirme a prévia."
  );
}

/**
 * @param {string} question
 * @param {Array<{ role?: string, content?: string }>} history
 */
export function shouldSkipAcervoForCreationFollowUp(question, history = []) {
  const q = String(question || "").trim();
  if (!q) return false;
  if (isCatalogListingRequest(q)) return false;

  if (shouldPreferImageBriefingOverAcervo(q, history)) return true;

  const turn = parseCreationTurn(q);
  if (turn.isBareSelection && turn.productQuery) return false;

  if (turn.isRevisionOnly && hasActiveCreationContext(history)) return true;

  const state = deriveCreationStateFromHistory(history);
  if (state.produto && !turn.productQuery && hasCreationAttributes(turn)) {
    return true;
  }

  return false;
}
