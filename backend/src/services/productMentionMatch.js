/**
 * Vincula produtos do acervo ao que o cliente citou no pedido (ex.: "monster" ≠ "pro force morango").
 */

import {
  pickBestProductMidiaId,
  pickHeroProductMidiaId,
  rankReferenceMidiaIds,
} from "./referenceMidiaRanking.js";

const PRODUCT_MENTION_STOP = new Set([
  "com",
  "para",
  "uma",
  "uns",
  "umas",
  "arte",
  "post",
  "postagem",
  "foto",
  "quero",
  "usar",
  "sera",
  "seria",
  "mais",
  "muito",
  "promo",
  "promocao",
  "promocional",
  "dia",
  "dos",
  "das",
  "de",
  "do",
  "da",
  "e",
  "ou",
  "na",
  "no",
  "em",
  "por",
  "pra",
  "fazer",
  "faca",
  "faça",
  "bem",
  "so",
  "só",
  "que",
  "temos",
  "tem",
  "reais",
  "real",
  "chamativo",
  "chamativa",
  "academia",
  "academias",
  "somente",
  "apenas",
  "sobre",
  "tipo",
  "essa",
  "esse",
  "isso",
  "aqui",
  "agora",
  "hoje",
]);

/** Linha + sabor/variante explícitos no pedido → só esses PNGs (não todas as creatinas). */
const PRODUCT_BASE_WORDS = [
  "creatina",
  "whey",
  "proteina",
  "protein",
  "bcaa",
  "glutamina",
  "albumina",
  "colageno",
  "collagen",
  "preworkout",
  "pre-treino",
  "pretreino",
];

/** Variantes citadas junto de "creatina(s)" (ex.: integral, growth). */
const PRODUCT_VARIANT_QUALIFIERS = new Set([
  "integral",
  "growth",
  "max",
  "black",
  "morango",
  "chocolate",
  "baunilha",
  "vanilla",
  "isolado",
  "isolada",
  "concentrado",
  "concentrada",
  "medica",
  "titanium",
  "skull",
  "dark",
  "lab",
  "refil",
  "sache",
  "pote",
  "dux",
  "nutri",
  "cookies",
  "cookie",
  "cafe",
  "kit",
  "conjunto",
  "cinnamon",
  "canela",
  "avela",
  "branco",
  "wafer",
  "naked",
  "force",
]);

/** Tokens curtos que ainda identificam produto/marca no pedido. */
const PRODUCT_SHORT_TOKENS = new Set(["pro", "max", "dux", "whey", "bcaa", "off"]);

/**
 * Marcas com grafias comuns (espaço, hífen, junto, typo leve).
 * @type {Array<{ canonical: string, patterns: RegExp[] }>}
 */
const PRODUCT_BRAND_LINES = [
  {
    canonical: "pro force",
    patterns: [/\bpro\s*[-_/]?\s*force\b/i, /\bproforce\b/i],
  },
  {
    canonical: "monster",
    patterns: [/\bmonster(?:\s+energy)?\b/i, /\bmonsterenergy\b/i],
  },
  {
    canonical: "black skull",
    patterns: [/\bblack\s*[-_]?\s*skull\b/i, /\bblackskull\b/i],
  },
  {
    canonical: "integral medica",
    patterns: [/\bintegral\s*[-_]?\s*medica\b/i, /\bintegralmedica\b/i],
  },
  {
    canonical: "growth supplements",
    patterns: [/\bgrowth\s*[-_]?\s*supplements?\b/i],
  },
  {
    canonical: "max titanium",
    patterns: [/\bmax\s*[-_]?\s*titanium\b/i, /\bmaxtitanium\b/i],
  },
  {
    canonical: "dark lab",
    patterns: [/\bdark\s*[-_]?\s*lab\b/i, /\bdarklab\b/i],
  },
  {
    canonical: "optimum nutrition",
    patterns: [/\boptimum\s*[-_]?\s*nutrition\b/i],
  },
  {
    canonical: "dux nutrition",
    patterns: [/\bdux\s*[-_]?\s*nutrition\b/i],
  },
  {
    canonical: "whey growth",
    patterns: [/\bwhey\s+growth\b/i, /\bgrowth\s+whey\b/i],
  },
  {
    canonical: "naked wafer",
    patterns: [
      /\bnaked\s+wafer\b/i,
      /\bbarrinha\s+(?:de\s+proteina\s+)?naked\b/i,
      /\bbarras?\s+(?:de\s+proteina\s+)?naked\b/i,
    ],
  },
];

/** Sabores/variantes por linha de marca — evita “pro force” genérico quando há sabor no pedido. */
const BRAND_LINE_FLAVORS = {
  "pro force": ["morango", "chocolate", "cookies", "cookie", "cafe", "kit", "conjunto"],
  "whey growth": ["cookies", "cookie", "chocolate", "baunilha"],
  "naked wafer": ["dark chocolate", "chocolate branco", "branco", "cinnamon", "canela", "avela", "dark"],
};

/** Frases de categoria (bebidas, etc.) — várias linhas do acervo. */
const PRODUCT_CATEGORY_PHRASES = [
  {
    patterns: [/\bbebidas?\s+proteicas?\b/i, /\bshakes?\s+proteic/i],
    phrases: [
      "monster",
      "pro force cafe",
      "whey growth cookies",
      "whey growth chocolate",
      "whey growth baunilha",
    ],
  },
];

/** Sabores isolados não viram termo genérico (evita “chocolate” puxar pf + whey + barra). */
const GENERIC_FLAVOR_STOP = new Set([
  "chocolate",
  "cookies",
  "cookie",
  "morango",
  "baunilha",
  "cafe",
  "cinnamon",
  "canela",
  "avela",
  "branco",
  "dark",
  "wafer",
  "naked",
  "sabores",
  "sabor",
]);

export function normalizeProductSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bwaffer\b/g, "wafer")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove espaços, hífens e pontuação — "pro-force" e "pro force" ficam iguais. */
export function compactProductKey(value) {
  return normalizeProductSearchText(value).replace(/[^a-z0-9]/g, "");
}

/** Variantes de sabor no nome do arquivo (cookie ↔ cookies). */
function flavorTokenVariants(token) {
  const t = normalizeProductSearchText(token);
  if (t === "cookies") return ["cookies", "cookie"];
  if (t === "cookie") return ["cookie", "cookies"];
  return [t];
}

/** Sinônimos que o cliente pode escrever no chat (não precisa bater com o nome do PNG). */
const FLAVOR_DETECTORS = [
  { canon: "baunilha", re: /\b(baunilha|vanilla)\b/i },
  { canon: "chocolate", re: /\b(chocolate|choco)\b/i },
  { canon: "cookies", re: /\b(cookies?|cook)\b/i },
  { canon: "morango", re: /\b(morango|strawberry)\b/i },
  { canon: "cafe", re: /\b(cafe|coffee)\b/i },
  { canon: "canela", re: /\b(canela|cinnamon)\b/i },
  { canon: "avela", re: /\bavela\b/i },
];

/**
 * Sabores citados no pedido (texto livre).
 * @param {string} text
 * @returns {string[]}
 */
function extractFlavorsFromText(text) {
  const n = normalizeProductSearchText(text);
  const found = [];
  for (const { canon, re } of FLAVOR_DETECTORS) {
    re.lastIndex = 0;
    if (re.test(n) && !found.includes(canon)) found.push(canon);
  }
  return found;
}

/**
 * @param {string} token
 * @returns {string | null}
 */
function mapLooseTokenToFlavor(token) {
  const t = normalizeProductSearchText(token);
  if (WHEY_LOOSE_CAPTURE_SKIP.has(t)) return null;
  const aliases = {
    vanilla: "baunilha",
    baunilha: "baunilha",
    choco: "chocolate",
    chocolate: "chocolate",
    cookie: "cookies",
    cookies: "cookies",
    cook: "cookies",
    morango: "morango",
    strawberry: "morango",
    cafe: "cafe",
    coffee: "cafe",
    canela: "canela",
    cinnamon: "canela",
    avela: "avela",
  };
  if (aliases[t]) return aliases[t];
  if (t === "cookie") return "cookies";
  if (PRODUCT_VARIANT_QUALIFIERS.has(t)) return t;
  return null;
}

/** Expande tokens de discriminador com sinônimos (vanilla → baunilha, etc.). */
function expandFlavorSynonyms(tokens) {
  const out = new Set();
  for (const raw of tokens) {
    for (const v of flavorTokenVariants(raw)) out.add(v);
    const mapped = mapLooseTokenToFlavor(raw);
    if (mapped) {
      out.add(mapped);
      for (const v of flavorTokenVariants(mapped)) out.add(v);
    }
    if (raw === "vanilla" || raw === "baunilha") {
      out.add("baunilha");
      out.add("vanilla");
    }
    if (raw === "choco" || raw === "chocolate") {
      out.add("chocolate");
      out.add("choco");
    }
  }
  return [...out];
}

/**
 * @param {string} blob
 * @param {string} token
 */
function blobContainsFlavorToken(blob, token) {
  const b = normalizeProductSearchText(blob);
  const compactB = compactProductKey(blob);
  for (const v of expandFlavorSynonyms([token])) {
    if (b.includes(v)) return true;
    const c = compactProductKey(v);
    if (c.length >= 3 && compactB.includes(c)) return true;
  }
  return scoreTypoTokenInBlob(b, token) >= 55;
}

/**
 * Match flexível: linha do produto + sabor no acervo, sem exigir «whey growth» no nome do arquivo.
 * @param {string} blob
 * @param {string} phrase
 */
function scoreFlexibleQualifiedPhrase(blob, phrase) {
  if (!isQualifiedProductPhrase(phrase)) return 0;
  const p = normalizeProductSearchText(phrase).replace(/\s+/g, " ").trim();
  const b = normalizeProductSearchText(blob);
  if (!discriminatorsSatisfiedInBlob(blob, phrase)) return 0;

  if (p.startsWith("whey ") && !/\bwhey\b/.test(b) && !compactProductKey(blob).includes("whey")) return 0;
  if (
    p.startsWith("pro force") &&
    !/\bpro\s*[-_/]?\s*force\b/.test(b) &&
    !compactProductKey(blob).includes("proforce")
  ) {
    return 0;
  }
  if (p.startsWith("creatina ") && !/\bcreatina\b/.test(b)) return 0;
  if (p.startsWith("naked wafer") && !/\bnaked\b/.test(b) && !/\bwafer\b/.test(b)) return 0;

  return 58 + getPhraseDiscriminatorGroups(phrase).flat().length * 6;
}

/**
 * @param {string} haystack
 * @param {string} token
 * @param {number} [from]
 */
function indexOfTokenInHaystack(haystack, token, from = 0) {
  const h = normalizeProductSearchText(haystack);
  const variants = flavorTokenVariants(token);
  let best = -1;
  for (const v of variants) {
    const idx = h.indexOf(v, from);
    if (idx >= 0 && (best < 0 || idx < best)) best = idx;
  }
  return best;
}

/**
 * @param {string} haystack
 * @param {string[]} words
 */
export function tokensAppearInOrder(haystack, words) {
  const list = (words || []).map((w) => normalizeProductSearchText(w).trim()).filter((w) => w.length >= 2);
  if (!list.length) return false;
  let pos = 0;
  const h = normalizeProductSearchText(haystack);
  for (const w of list) {
    const idx = indexOfTokenInHaystack(h, w, pos);
    if (idx < 0) return false;
    const matched = flavorTokenVariants(w).find((v) => h.indexOf(v, pos) === idx) || w;
    pos = idx + matched.length;
  }
  return true;
}

/**
 * @param {string} a
 * @param {string} b
 */
function levenshtein(a, b) {
  const s = a.length ? a : "";
  const t = b.length ? b : "";
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const row = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const tmp = row[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[t.length];
}

/**
 * @param {string} blob
 * @param {string} term
 */
function scoreTypoTokenInBlob(blob, term) {
  const t = compactProductKey(term);
  if (t.length < 6) return 0;
  const words = [
    ...new Set(
      normalizeProductSearchText(blob)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 5),
    ),
  ];
  let best = Infinity;
  for (const w of words) {
    if (Math.abs(w.length - t.length) > 2) continue;
    best = Math.min(best, levenshtein(w, t));
  }
  if (best === 1) return 72;
  if (best === 2 && t.length >= 8) return 55;
  return 0;
}

/** Frases só de marca/linha — sem sabor/variante no pedido. */
const BARE_PRODUCT_LINE_PHRASES = new Set([
  "pro force",
  "whey growth",
  "naked wafer",
  "creatina",
  "monster",
  ...PRODUCT_BRAND_LINES.map((l) => l.canonical),
]);

/** Variante explícita → tokens que precisam aparecer no PNG (qualquer um do grupo). */
const PHRASE_DISCRIMINATOR_GROUPS = {
  "pro force morango": [["morango"]],
  "pro force chocolate": [["chocolate"]],
  "pro force cookies": [["cookies", "cookie"]],
  "pro force cafe": [["cafe"]],
  "pro force kit": [["kit", "conjunto", "sabores"]],
  "whey growth cookies": [["cookies", "cookie"]],
  "whey growth chocolate": [["chocolate"]],
  "whey growth baunilha": [["baunilha"]],
  "whey cookies": [["cookies", "cookie"]],
  "whey cookie": [["cookies", "cookie"]],
  "whey chocolate": [["chocolate"]],
  "whey baunilha": [["baunilha"]],
  "naked wafer dark chocolate": [["dark"], ["chocolate"]],
  "naked wafer chocolate branco": [["branco"]],
  "naked wafer avela branco": [["avela"]],
  "naked wafer cinnamon": [["cinnamon", "canela"]],
  "naked wafer avela": [["avela"]],
  "creatina integral": [["integral"]],
  "creatina growth": [["growth"]],
  "creatina max": [["max"]],
};

/** Produto único no acervo (não é linha com sabores). */
const STANDALONE_SKU_PHRASES = new Set(["monster"]);

/** Marca no pedido que pode não existir no nome do arquivo (ex.: «whey de chocolate»). */
const WHEY_OPTIONAL_BRAND_TOKENS = new Set(["growth", "supplements"]);

/** Tokens após «whey de/sabor» que não são sabor (evita «whey growth cookies» → sabor growth). */
const WHEY_LOOSE_CAPTURE_SKIP = new Set([
  "growth",
  "supplements",
  "protein",
  "proteina",
  "max",
  "titanium",
  "integral",
  "medica",
  "nutri",
  "nutrition",
  "lab",
  "force",
]);

function phraseRequiresDiscriminators(phrase) {
  const p = normalizeProductSearchText(phrase).replace(/\s+/g, " ").trim();
  if (PHRASE_DISCRIMINATOR_GROUPS[p]) return true;
  return p.startsWith("creatina ") && p.length > "creatina ".length;
}

/**
 * Grupos de tokens discriminadores (AND entre grupos, OR dentro do grupo).
 * @param {string} phrase
 * @returns {string[][]}
 */
export function getPhraseDiscriminatorGroups(phrase) {
  const p = normalizeProductSearchText(phrase).replace(/\s+/g, " ").trim();
  if (PHRASE_DISCRIMINATOR_GROUPS[p]) {
    return PHRASE_DISCRIMINATOR_GROUPS[p];
  }
  if (BARE_PRODUCT_LINE_PHRASES.has(p) || STANDALONE_SKU_PHRASES.has(p)) return [];

  const brandTails = [
    ["naked wafer", 11],
    ["whey growth", 11],
    ["pro force", 9],
    ["integral medica", 15],
    ["growth supplements", 18],
    ["max titanium", 12],
    ["creatina", 8],
  ].sort((a, b) => b[1] - a[1]);

  for (const [brand] of brandTails) {
    if (p.startsWith(`${brand} `)) {
      const tail = p.slice(brand.length + 1).trim();
      if (!tail) return [];
      if (tail.includes("dark chocolate")) return [["dark"], ["chocolate"]];
      if (tail.includes("chocolate branco")) return [["branco"]];
      if (tail.includes("avela branco")) return [["avela"]];
      return [tail.split(/\s+/).filter((w) => w.length >= 3)];
    }
  }

  if (p.startsWith("creatina ")) {
    const tail = p.slice("creatina ".length);
    return tail ? [[tail]] : [];
  }

  const words = p.split(" ").filter((w) => w.length >= 3);
  return words.length ? [words] : [];
}

/** Pedido cita variante concreta (não só a linha/marca). */
export function isQualifiedProductPhrase(phrase) {
  const p = normalizeProductSearchText(phrase).replace(/\s+/g, " ").trim();
  if (BARE_PRODUCT_LINE_PHRASES.has(p)) return false;
  if (STANDALONE_SKU_PHRASES.has(p)) return true;
  return phraseRequiresDiscriminators(p);
}

/**
 * @param {string} blob
 * @param {string} phrase
 */
function discriminatorsSatisfiedInBlob(blob, phrase) {
  const groups = getPhraseDiscriminatorGroups(phrase);
  if (!groups.length) return true;
  return groups.every((group) => group.some((token) => blobContainsFlavorToken(blob, token)));
}

/**
 * Pontua o quanto uma frase do pedido aparece no texto da mídia (fuzzy).
 * Frases qualificadas exigem discriminadores (sabor/variante) no blob.
 * @param {string} blob
 * @param {string} phrase
 */
export function scorePhraseAgainstBlob(blob, phrase) {
  const p = normalizeProductSearchText(phrase).replace(/\s+/g, " ").trim();
  const b = normalizeProductSearchText(blob);
  if (!p || !b) return 0;

  const words = p.split(" ").filter((w) => w.length >= 2);
  const compactP = compactProductKey(p);
  const compactB = compactProductKey(b);
  let score = 0;

  if (b.includes(p)) score = 120 + p.length;
  else if (compactP.length >= 4 && compactB.includes(compactP)) {
    score = 105 + compactP.length;
  } else if (words.length >= 2 && tokensAppearInOrder(b, words)) {
    score = 90 + p.length;
  } else if (words.length === 1) {
    const single = words[0];
    if (b.includes(single)) score = 80 + single.length;
    else if (compactB.includes(compactProductKey(single))) score = 75 + single.length;
    else score = scoreTypoTokenInBlob(b, single);
  }

  if (
    score === 0 &&
    words.length >= 2 &&
    (p.startsWith("whey ") || words[0] === "whey")
  ) {
    const relaxed = words.filter(
      (w) =>
        !WHEY_OPTIONAL_BRAND_TOKENS.has(w) ||
        b.includes(w) ||
        compactB.includes(compactProductKey(w)),
    );
    if (relaxed.length >= 2 && tokensAppearInOrder(b, relaxed)) {
      score = 88 + relaxed.join(" ").length;
    }
  }

  if (score > 0 && phraseRequiresDiscriminators(p) && !discriminatorsSatisfiedInBlob(blob, p)) {
    return 0;
  }

  if (score < 35 && isQualifiedProductPhrase(p)) {
    score = Math.max(score, scoreFlexibleQualifiedPhrase(blob, p));
  }

  if (score === 0 && BARE_PRODUCT_LINE_PHRASES.has(p)) {
    score = scoreBareProductLineInBlob(blob, p);
  }

  return score;
}

/**
 * Linha inteira pedida sem sabor (ex.: «os 3 wheys» → todos os PNGs com whey no nome).
 * @param {string} blob
 * @param {string} phrase
 */
function scoreBareProductLineInBlob(blob, phrase) {
  const p = normalizeProductSearchText(phrase).replace(/\s+/g, " ").trim();
  const b = normalizeProductSearchText(blob);
  const compactB = compactProductKey(blob);
  if (p === "whey growth" || p === "whey") {
    return /\bwhey\b/.test(b) || compactB.includes("whey") ? 78 : 0;
  }
  if (p === "pro force") {
    return /\bpro\s*[-_/]?\s*force\b/.test(b) || compactB.includes("proforce") ? 80 : 0;
  }
  if (p === "naked wafer") {
    return /\bnaked\b/.test(b) && /\bwafer\b/.test(b) ? 76 : 0;
  }
  if (p === "creatina") {
    return /\bcreatina\b/.test(b) || compactB.includes("creatina") ? 76 : 0;
  }
  if (p === "monster") {
    return /\bmonster\b/.test(b) || compactB.includes("monster") ? 76 : 0;
  }
  const words = p.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length && words.every((w) => b.includes(w) || compactB.includes(compactProductKey(w)))) {
    return 74 + words.join("").length;
  }
  return 0;
}

/** @param {Record<string, unknown>} row */
function midiaRowId(row) {
  return String(row?.id_midia ?? row?.id ?? "").trim();
}

export function buildMidiaSearchBlob(row) {
  const path = String(row?.caminho_storage ?? "").replace(/[/\\]+/g, " ");
  const raw = `${row?.nome_exibicao ?? ""} ${row?.nome_arquivo ?? ""} ${row?.descricao ?? ""} ${row?.alt_text ?? ""} ${path}`;
  const normalized = normalizeProductSearchText(raw);
  const parts = normalized.split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
  const compact = compactProductKey(raw);
  return `${normalized} ${parts.join(" ")} ${compact}`.trim();
}

function brandLineMatches(normalized, line) {
  for (const re of line.patterns) {
    re.lastIndex = 0;
    if (re.test(normalized)) return true;
  }
  return false;
}

function extractBrandPhrases(hint) {
  const normalized = normalizeProductSearchText(hint);
  const phrases = new Set();
  for (const line of PRODUCT_BRAND_LINES) {
    if (brandLineMatches(normalized, line)) {
      phrases.add(line.canonical);
    }
  }
  return [...phrases];
}

function wantsAllBrandVariants(normalized) {
  return (
    /\b(todos|todas|linha\s+completa|completa|todos?\s+os|todas?\s+as)\b/.test(normalized) ||
    /\btodos?\s+sabores\b/.test(normalized)
  );
}

/**
 * @param {Set<string>} phrases
 */
const ORPHAN_FLAVOR_ONLY = /^(cookies?|baunilha|chocolate|morango|cafe|canela|cinnamon|avela)$/;

/** Divide pedido em trechos (“whey cookies e pro force morango”). */
function splitPedidoClauses(normalized) {
  const raw = normalized
    .split(/\s+(?:e|com)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const merged = [];
  for (const clause of raw) {
    const last = merged[merged.length - 1];
    const flavorOnly =
      ORPHAN_FLAVOR_ONLY.test(clause) ||
      /^de\s+(cookies?|baunilha|chocolate|morango|cafe)\b/.test(clause) ||
      (clause.split(/\s+/).length <= 2 &&
        /\b(cookies?|baunilha|chocolate|morango|cafe)\b/.test(clause) &&
        !clauseMentionsProForce(clause) &&
        !clauseMentionsWhey(clause));
    if (last && flavorOnly) {
      if (clauseMentionsWhey(last) || clauseMentionsProForce(last) || /\b(barra|naked)\b/.test(last)) {
        merged[merged.length - 1] = `${last} ${clause}`;
        continue;
      }
    }
    merged.push(clause);
  }
  return merged;
}

function clauseMentionsProForce(clause) {
  return /\bpro\s*[-_/]?\s*force\b/.test(clause) || /\bproforce\b/.test(clause);
}

function clauseMentionsWhey(clause) {
  return /\bwheys?\b/.test(clause);
}

function addWheyFlavorPhrases(phrases, flavor) {
  const f = String(flavor || "").trim();
  if (!f) return;
  phrases.add(`whey growth ${f}`);
  phrases.add(`whey ${f}`);
}

function pruneBareBrandWhenQualified(phrases) {
  const list = [...phrases];
  for (const canon of Object.keys(BRAND_LINE_FLAVORS)) {
    const qualified = list.filter((p) => p.startsWith(`${canon} `) && p.length > canon.length + 2);
    if (qualified.length) phrases.delete(canon);
  }
}

function extractCategoryPhrases(normalized) {
  const phrases = new Set();
  for (const cat of PRODUCT_CATEGORY_PHRASES) {
    for (const re of cat.patterns) {
      re.lastIndex = 0;
      if (re.test(normalized)) {
        for (const p of cat.phrases) phrases.add(p);
        break;
      }
    }
  }
  return [...phrases];
}

function extractProForceScopedPhrases(normalized) {
  const hasPf =
    /\bpro\s*[-_/]?\s*force\b/.test(normalized) || /\bproforce\b/.test(normalized);
  if (!hasPf) return [];

  const phrases = new Set();
  const pfClauses = splitPedidoClauses(normalized).filter(clauseMentionsProForce);
  const scope = pfClauses.length ? pfClauses : [normalized];

  const kitInScope = scope.some((c) =>
    /\bkit\s*4\b|\bkit4\b|\bconjunto\b|\b4\s*sabores\b/.test(c),
  );
  if (kitInScope) {
    phrases.add("pro force kit");
    return [...phrases];
  }

  for (const clause of scope) {
    if (/\bmorango\b/.test(clause)) phrases.add("pro force morango");
    if (/\bchocolate\b/.test(clause)) phrases.add("pro force chocolate");
    if (/\bcookies?\b/.test(clause)) phrases.add("pro force cookies");
    if (/\bcafe\b/.test(clause)) phrases.add("pro force cafe");
  }

  if (phrases.size) return [...phrases];

  if (wantsAllBrandVariants(normalized)) {
    phrases.add("pro force");
    return [...phrases];
  }

  phrases.add("pro force");
  return [...phrases];
}

function wantsAllWheyVariants(normalized) {
  return (
    wantsAllBrandVariants(normalized) ||
    /\b(os|as|uns|umas)\s+wheys?\b/.test(normalized) ||
    /\b(\d+|tres|três|quatro|4|5)\s+wheys?\b/.test(normalized) ||
    /\bfotos?\s+(dos|das|de)?\s*wheys?\b/.test(normalized) ||
    /\bwheys?\s+da\s+(loja|linha|marca)\b/.test(normalized)
  );
}

function extractLooseProductPhrases(normalized) {
  const phrases = new Set();

  if (/\bwheys?\b/.test(normalized)) {
    let m;
    const wheyLoose = /\bwheys?\s+(?:de|do|da|sabor)?\s*([a-z]{3,})\b/gi;
    while ((m = wheyLoose.exec(normalized)) !== null) {
      const raw = normalizeProductSearchText(m[1]);
      if (WHEY_LOOSE_CAPTURE_SKIP.has(raw)) continue;
      const flavor = mapLooseTokenToFlavor(raw);
      if (flavor && flavor !== "growth") addWheyFlavorPhrases(phrases, flavor);
    }
  }

  let m;
  const pfLoose = /\bpro\s*[-_/]?\s*force\s+(?:de|do|sabor)?\s*([a-z]{3,})\b/gi;
  while ((m = pfLoose.exec(normalized)) !== null) {
    const flavor = mapLooseTokenToFlavor(m[1]);
    if (flavor === "morango") phrases.add("pro force morango");
    else if (flavor === "chocolate") phrases.add("pro force chocolate");
    else if (flavor === "cookies") phrases.add("pro force cookies");
    else if (flavor === "cafe") phrases.add("pro force cafe");
  }

  return [...phrases];
}

function extractWheyScopedPhrases(normalized) {
  if (!/\bwheys?\b/.test(normalized)) return [];

  const phrases = new Set();
  const wheyClauses = splitPedidoClauses(normalized).filter(clauseMentionsWhey);
  const scope = wheyClauses.length ? wheyClauses : [normalized];

  const flavors = [];
  for (const clause of scope) {
    for (const f of extractFlavorsFromText(clause)) {
      if (!flavors.includes(f)) flavors.push(f);
    }
  }
  if (!flavors.length) {
    for (const f of extractFlavorsFromText(normalized)) {
      if (!flavors.includes(f)) flavors.push(f);
    }
  }

  if (flavors.length) {
    for (const f of flavors) addWheyFlavorPhrases(phrases, f);
    return [...phrases];
  }

  const sharedCookie =
    /\bcookies?\b/.test(normalized) &&
    /\bwheys?\b/.test(normalized) &&
    scope.some((c) => clauseMentionsWhey(c) && !/\bcookies?\b/.test(c));
  if (sharedCookie) {
    addWheyFlavorPhrases(phrases, "cookies");
    return [...phrases];
  }

  const sharedChocolate =
    /\bchocolate\b/.test(normalized) &&
    /\bwheys?\b/.test(normalized) &&
    scope.some((c) => clauseMentionsWhey(c) && !/\bchocolate\b/.test(c)) &&
    !/\btudo\b/.test(normalized);
  if (sharedChocolate) {
    addWheyFlavorPhrases(phrases, "chocolate");
    return [...phrases];
  }

  if (wantsAllWheyVariants(normalized)) {
    phrases.add("whey growth");
    return [...phrases];
  }

  if (scope.some((c) => /\bwhey\s+growth\b|\bgrowth\s+whey\b/.test(c)) || /\bwheys?\b/.test(normalized)) {
    phrases.add("whey growth");
  }
  return [...phrases];
}

function nakedWaferFlavorFromClause(clause) {
  const c = String(clause || "").trim();
  if (!c) return null;
  if (/\bdark\s+chocolate\b/.test(c)) return "naked wafer dark chocolate";
  if (/\bchocolate\s+branco\b/.test(c)) return "naked wafer chocolate branco";
  if (/\bcinnamon\b|\bcanela\b/.test(c)) return "naked wafer cinnamon";
  if (/\bavela\s+branco\b/.test(c)) return "naked wafer avela branco";
  if (/\bavela\b/.test(c)) return "naked wafer avela";
  return null;
}

function extractNakedWaferScopedPhrases(normalized) {
  const hasNaked =
    /\bnaked\s+wafer\b/.test(normalized) ||
    /\bnaked\s+waffer\b/.test(normalized) ||
    (/\b(barra|barrinha|barras)\b/.test(normalized) && /\bnaked\b/.test(normalized)) ||
    (/\bnaked\b/.test(normalized) && /\b(wafer|waffer|barrinha|barra)\b/.test(normalized));

  if (!hasNaked) return [];

  const phrases = new Set();
  for (const clause of splitPedidoClauses(normalized)) {
    let scoped = clause;
    if (!/\bnaked\b/.test(scoped) && !/\b(wafer|waffer|barra|barrinha)\b/.test(scoped)) {
      if (
        ORPHAN_FLAVOR_ONLY.test(scoped) ||
        /\b(chocolate|avela|canela|cinnamon|branco|dark)\b/.test(scoped)
      ) {
        scoped = `naked wafer ${scoped}`;
      }
    }
    const flavor = nakedWaferFlavorFromClause(scoped);
    if (flavor) phrases.add(flavor);
  }

  if (phrases.size) return [...phrases];

  const cookieTudo =
    /\btudo\b/.test(normalized) &&
    (/\bcookies?\b/.test(normalized) || /\btudo\s+de\s+cookie/.test(normalized));
  if (cookieTudo && !/\b(canela|cinnamon|avela|branco|dark)\b/.test(normalized)) {
    return [];
  }

  if (wantsAllBrandVariants(normalized) || /\bbarras?\s+de\s+proteina\b/.test(normalized)) {
    phrases.add("naked wafer");
  } else if (!/\bchocolate\b/.test(normalized)) {
    phrases.add("naked wafer");
  }
  return [...phrases];
}

function extractCrossProductFlavorPhrases(normalized) {
  const phrases = new Set();
  const tudoMatch = normalized.match(/\btudo\s+de\s+([a-z]+)/);
  const tudoFlavor = tudoMatch ? tudoMatch[1] : null;

  const cookieIntent =
    /\bcookies?\b/.test(normalized) || tudoFlavor === "cookie" || tudoFlavor === "cookies";
  const chocolateIntent =
    /\bchocolate\b/.test(normalized) || tudoFlavor === "chocolate";

  const broad = /\btudo\b/.test(normalized);
  const hasPf = /\bpro\s*[-_/]?\s*force\b/.test(normalized) || /\bproforce\b/.test(normalized);

  if (cookieIntent && broad) {
    if (/\bwheys?\b/.test(normalized)) addWheyFlavorPhrases(phrases, "cookies");
    if (hasPf) phrases.add("pro force cookies");
  }

  if (chocolateIntent && (/\btudo\b/.test(normalized) || tudoFlavor === "chocolate")) {
    phrases.add("pro force chocolate");
    addWheyFlavorPhrases(phrases, "chocolate");
    phrases.add("naked wafer dark chocolate");
  }

  return [...phrases];
}

function extractBrandScopedPhrases(normalized) {
  const phrases = new Set();
  for (const line of PRODUCT_BRAND_LINES) {
    if (!brandLineMatches(normalized, line)) continue;
    const canon = line.canonical;
    if (canon === "pro force") continue;
    if (canon === "whey growth" || canon === "naked wafer") continue;
    if (wantsAllBrandVariants(normalized)) {
      phrases.add(canon);
      continue;
    }
    const catalog = BRAND_LINE_FLAVORS[canon];
    if (!catalog?.length) {
      phrases.add(canon);
      continue;
    }
    let hit = false;
    for (const flavor of catalog.sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`\\b${flavor.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (re.test(normalized)) {
        phrases.add(`${canon} ${flavor}`.replace(/\s+/g, " ").trim());
        hit = true;
      }
    }
    if (!hit) phrases.add(canon);
  }
  return [...phrases];
}

/**
 * Frases específicas (ex.: "creatina integral", "pro force morango") — pedido restrito.
 * @param {string} hint
 */
function extractSpecificProductPhrases(hint) {
  const normalized = normalizeProductSearchText(hint);
  const phrases = new Set();

  for (const p of extractCategoryPhrases(normalized)) phrases.add(p);
  for (const p of extractProForceScopedPhrases(normalized)) phrases.add(p);
  for (const p of extractWheyScopedPhrases(normalized)) phrases.add(p);
  for (const p of extractNakedWaferScopedPhrases(normalized)) phrases.add(p);
  for (const p of extractCrossProductFlavorPhrases(normalized)) phrases.add(p);
  for (const p of extractBrandScopedPhrases(normalized)) phrases.add(p);
  for (const p of extractLooseProductPhrases(normalized)) phrases.add(p);

  for (const base of PRODUCT_BASE_WORDS) {
    if (base === "whey" || base === "proteina") continue;
    const re = new RegExp(`\\b${base.replace(/-/g, "[- ]?")}\\s+([a-z][a-z0-9]{2,})\\b`, "gi");
    let m;
    while ((m = re.exec(normalized)) !== null) {
      const qual = m[1];
      if (PRODUCT_MENTION_STOP.has(qual) || !PRODUCT_VARIANT_QUALIFIERS.has(qual)) continue;
      phrases.add(`${base.replace(/-/g, " ")} ${qual}`.replace(/\s+/g, " ").trim());
    }
  }

  if (/\bcreatinas?\b/.test(normalized)) {
    for (const qual of PRODUCT_VARIANT_QUALIFIERS) {
      const re = new RegExp(`\\b${qual}\\b`, "i");
      if (re.test(normalized)) {
        phrases.add(`creatina ${qual}`);
      }
    }
  }

  pruneBareBrandWhenQualified(phrases);
  return [...phrases];
}

function extractGenericProductMentions(hint) {
  const normalized = normalizeProductSearchText(hint);
  const mentions = new Set(extractBrandPhrases(normalized));

  const tokens = [...new Set(normalized.match(/[a-z0-9]+/g) || [])].filter((token) => {
    if (PRODUCT_MENTION_STOP.has(token)) return false;
    if (GENERIC_FLAVOR_STOP.has(token)) return false;
    if (token.length >= 4) return true;
    return PRODUCT_SHORT_TOKENS.has(token);
  });
  for (const token of tokens) {
    mentions.add(token);
  }

  return [...mentions];
}

/**
 * @param {string} userHint
 * @returns {{
 *   mode: "none" | "specific" | "generic",
 *   terms: string[],
 *   specificPhrases: string[],
 *   genericTerms: string[],
 * }}
 */
export function parseProductMentionSpec(userHint) {
  const hint = normalizeProductSearchText(userHint);
  if (!hint.trim()) {
    return { mode: "none", terms: [], specificPhrases: [], genericTerms: [] };
  }

  const specificPhrases = extractSpecificProductPhrases(hint);
  if (specificPhrases.length) {
    return {
      mode: "specific",
      terms: specificPhrases,
      specificPhrases,
      genericTerms: [],
    };
  }

  const genericTerms = extractGenericProductMentions(hint);
  if (!genericTerms.length) {
    return { mode: "none", terms: [], specificPhrases: [], genericTerms: [] };
  }

  return {
    mode: "generic",
    terms: genericTerms,
    specificPhrases: [],
    genericTerms,
  };
}

/**
 * Termos de produto explícitos no pedido do cliente.
 * @param {string} userHint
 * @returns {string[]}
 */
export function extractProductMentions(userHint) {
  return parseProductMentionSpec(userHint).terms;
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} phrase
 */
export function scoreRowSpecificPhrase(row, phrase) {
  return scorePhraseAgainstBlob(buildMidiaSearchBlob(row), phrase);
}

/**
 * @param {Record<string, unknown>} row
 * @param {ReturnType<typeof parseProductMentionSpec>} spec
 */
/**
 * @param {Record<string, unknown>} row
 * @param {string[]} phrases
 * @returns {{ phrase: string, score: number }}
 */
export function bestPhraseMatchForRow(row, phrases) {
  const blob = buildMidiaSearchBlob(row);
  let bestPhrase = "";
  let bestScore = 0;
  for (const phrase of phrases) {
    let score = scorePhraseAgainstBlob(blob, phrase);
    if (score < 35 && isQualifiedProductPhrase(phrase)) {
      score = Math.max(score, scoreFlexibleQualifiedPhrase(blob, phrase));
    }
    const p = normalizeProductSearchText(phrase);
    const tieBreak = isQualifiedProductPhrase(p) ? 1000 + p.length : p.length;
    const rank = score * 10000 + tieBreak;
    const bestRank = bestScore * 10000 + (isQualifiedProductPhrase(bestPhrase) ? 1000 + bestPhrase.length : bestPhrase.length);
    if (rank > bestRank) {
      bestScore = score;
      bestPhrase = phrase;
    }
  }
  return { phrase: bestPhrase, score: bestScore };
}

export function scoreRowForProductSpec(row, spec) {
  if (!spec || spec.mode === "none") return 0;
  if (spec.mode === "specific") {
    return bestPhraseMatchForRow(row, spec.specificPhrases).score;
  }
  return scoreRowProductMention(row, spec.genericTerms);
}

/**
 * @param {Record<string, unknown>} row
 * @param {ReturnType<typeof parseProductMentionSpec>} spec
 * @param {number} [minScore]
 */
export function rowMatchesProductSpec(row, spec, minScore = 35) {
  if (!spec || spec.mode === "none") return false;
  if (spec.mode === "generic") {
    return scoreRowProductMention(row, spec.genericTerms) >= minScore;
  }

  const qualified = spec.specificPhrases.filter((p) => isQualifiedProductPhrase(p));
  const { phrase: bestPhrase, score } = bestPhraseMatchForRow(row, spec.specificPhrases);
  const blob = buildMidiaSearchBlob(row);
  let effectiveScore = score;
  if (effectiveScore < minScore && qualified.length) {
    for (const ph of qualified) {
      effectiveScore = Math.max(effectiveScore, scoreFlexibleQualifiedPhrase(blob, ph));
    }
  }

  if (effectiveScore < minScore) return false;

  if (qualified.length > 0) {
    if (isQualifiedProductPhrase(bestPhrase)) {
      if (!discriminatorsSatisfiedInBlob(buildMidiaSearchBlob(row), bestPhrase)) return false;
      return qualified.includes(bestPhrase);
    }
    const barePhrases = spec.specificPhrases.filter((p) => !isQualifiedProductPhrase(p));
    return barePhrases.includes(bestPhrase);
  }

  return true;
}

/**
 * @param {Record<string, unknown>} row
 * @param {string[]} mentions
 */
export function scoreRowProductMention(row, mentions) {
  if (!mentions?.length) return 0;
  const blob = buildMidiaSearchBlob(row);
  if (!blob.trim()) return 0;

  let score = 0;
  for (const term of mentions) {
    const t = normalizeProductSearchText(term).replace(/\s+/g, " ").trim();
    if (!t) continue;

    const phraseScore = scorePhraseAgainstBlob(blob, t);
    if (phraseScore > 0) {
      score += phraseScore;
      continue;
    }

    if (t.length >= 5 && !t.endsWith("s") && blob.includes(`${t}s`)) {
      score += 70 + t.length;
      continue;
    }
    if (t.endsWith("s") && t.length >= 5) {
      const singular = t.slice(0, -1);
      if (blob.includes(singular)) {
        score += 70 + singular.length;
        continue;
      }
    }

    if (t.length >= 6) {
      const stem = t.slice(0, Math.max(5, Math.floor(t.length * 0.75)));
      if (stem.length >= 5 && blob.includes(stem)) {
        score += 35;
      }
    }
  }
  return score;
}

/**
 * @param {Array<Record<string, unknown>>} imageRows
 * @param {string} userHint
 * @param {number} [minScore]
 */
export function narrowImageRowsByProductMention(imageRows, userHint, minScore = 35) {
  const rows = Array.isArray(imageRows) ? imageRows : [];
  const spec = parseProductMentionSpec(userHint);
  if (spec.mode === "none") {
    return { pool: rows, mentions: [], strict: false, mode: "none" };
  }
  const pool = rows.filter((row) => rowMatchesProductSpec(row, spec, minScore));
  return { pool, mentions: spec.terms, strict: true, mode: spec.mode };
}

/**
 * @param {string} phrase
 */
function productKeyForQualifiedPhrase(phrase) {
  const p = normalizeProductSearchText(phrase).replace(/\s+/g, " ").trim();
  const wheyFlavor = p.match(/^whey(?:\s+growth)?\s+(?:de\s+)?(cookies?|chocolate|baunilha)\b/);
  if (wheyFlavor) {
    const flavor = wheyFlavor[1].replace(/s$/, "");
    return `whey:${flavor}`;
  }
  return p;
}

/**
 * @param {string[]} phrases
 */
function dedupeQualifiedPhrases(phrases) {
  const seen = new Set();
  const out = [];
  for (const phrase of phrases) {
    const key = productKeyForQualifiedPhrase(phrase);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

/**
 * Rótulo curto para mensagem de erro (sem «growth» se o arquivo for «whey de …»).
 * @param {string} phrase
 */
export function formatProductPhraseForUser(phrase) {
  const p = normalizeProductSearchText(phrase).replace(/\s+/g, " ").trim();
  return p.replace(/^whey growth /, "whey ").trim();
}

/**
 * Sabores/variantes pedidos que não têm PNG correspondente no acervo.
 * @param {string} userHint
 * @param {Array<Record<string, unknown>>} midiaRows
 * @param {number} [minScore]
 */
export function findUnmatchedQualifiedPhrases(userHint, midiaRows, minScore = 35) {
  const spec = parseProductMentionSpec(userHint);
  if (spec.mode !== "specific") return [];
  const qualified = dedupeQualifiedPhrases(
    spec.specificPhrases.filter((p) => isQualifiedProductPhrase(p)),
  );
  if (!qualified.length) return [];

  const imageRows = (Array.isArray(midiaRows) ? midiaRows : []).filter(
    (row) => String(row.tipo_midia ?? "").trim().toLowerCase() === "imagem",
  );
  const missing = [];
  for (const phrase of qualified) {
    const miniSpec = {
      mode: "specific",
      specificPhrases: [phrase],
      terms: [phrase],
      genericTerms: [],
    };
    const hit = imageRows.some((row) => rowMatchesProductSpec(row, miniSpec, minScore));
    if (!hit) missing.push(phrase);
  }
  return missing;
}

/**
 * @param {string[]} mentions
 */
export function buildMissingProductMediaMessage(mentions) {
  const list = (mentions || []).map((m) => formatProductPhraseForUser(m));
  const labels = list.slice(0, 2).map((m) => `«${m}»`).join(", ");
  const mais = list.length > 2 ? ` (+${list.length - 2})` : "";
  if (labels) {
    return `Não encontrei ${labels}${mais} em Mídias. Cadastre o PNG do produto e tente de novo.`;
  }
  return "Produto não encontrado em Mídias. Cadastre o PNG e tente de novo.";
}

/**
 * @param {string} userHint
 * @param {Array<Record<string, unknown>>} midiaRows
 */
export function checkProductMediaAvailability(userHint, midiaRows) {
  const mentions = extractProductMentions(userHint);
  if (!mentions.length) {
    return { strict: false, mentions: [], matchedRows: [], missing: false, unmatchedPhrases: [] };
  }
  const imageRows = (Array.isArray(midiaRows) ? midiaRows : []).filter(
    (row) => String(row.tipo_midia ?? "").trim().toLowerCase() === "imagem",
  );
  const { pool, strict } = narrowImageRowsByProductMention(imageRows, userHint);
  const unmatchedPhrases = findUnmatchedQualifiedPhrases(userHint, midiaRows);
  const displayMentions = unmatchedPhrases.length
    ? unmatchedPhrases.map(formatProductPhraseForUser)
    : mentions;
  return {
    strict,
    mentions: displayMentions,
    matchedRows: pool,
    missing: strict && (pool.length === 0 || unmatchedPhrases.length > 0),
    unmatchedPhrases,
  };
}

/**
 * Um PNG por sabor/variante explícito no pedido (ex.: avela branco + chocolate branco).
 *
 * @param {Array<Record<string, unknown>>} midiaRows
 * @param {ReturnType<typeof parseProductMentionSpec>} spec
 * @param {number} [limit]
 */
export function pickMidiasOnePerPhrase(midiaRows, spec, limit = 3) {
  if (!spec || spec.mode !== "specific") return [];
  const qualified = dedupeQualifiedPhrases(
    (spec.specificPhrases || []).filter((p) => isQualifiedProductPhrase(p)),
  );
  if (qualified.length < 2) return [];

  const imageRows = (Array.isArray(midiaRows) ? midiaRows : []).filter(
    (row) => String(row.tipo_midia ?? "").trim().toLowerCase() === "imagem",
  );
  const used = new Set();
  const out = [];

  for (const phrase of qualified) {
    const miniSpec = {
      mode: "specific",
      specificPhrases: [phrase],
      terms: [phrase],
      genericTerms: [],
    };
    let bestRow = null;
    let bestScore = 0;
    for (const row of imageRows) {
      const id = midiaRowId(row);
      if (!id || used.has(id)) continue;
      const score = scoreRowForProductSpec(row, miniSpec);
      if (score > bestScore) {
        bestScore = score;
        bestRow = row;
      }
    }
    if (bestRow && bestScore >= 35) {
      used.add(midiaRowId(bestRow));
      out.push(bestRow);
    }
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * @param {Array<Record<string, unknown>>} midiaRows
 * @param {string} userHint
 * @param {number} [limit]
 */
export function resolveMidiaRowsForPedido(midiaRows, userHint = "", limit = 3) {
  const rows = Array.isArray(midiaRows) ? midiaRows : [];
  if (!rows.length) return [];
  const pedidoHint = String(userHint || "").trim();
  const spec = parseProductMentionSpec(pedidoHint);
  const imageRows = rows.filter((row) => String(row.tipo_midia ?? "").trim().toLowerCase() === "imagem");
  if (!imageRows.length) return [];

  const perPhrase = pickMidiasOnePerPhrase(imageRows, spec, limit);
  if (perPhrase.length >= 2) {
    const heroId = pickHeroProductMidiaId(perPhrase, pedidoHint);
    if (heroId) {
      const heroRow = perPhrase.find((row) => midiaRowId(row) === heroId);
      if (heroRow) {
        return [heroRow, ...perPhrase.filter((row) => midiaRowId(row) !== heroId)].slice(0, limit);
      }
    }
    return perPhrase.slice(0, limit);
  }

  const { pool, strict } = narrowImageRowsByProductMention(imageRows, pedidoHint);
  const searchPool = strict ? pool : imageRows;
  if (strict && !searchPool.length) return [];

  const scored = searchPool
    .map((row) => ({ row, score: scoreRowForProductSpec(row, spec) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    if (strict) return [];
    const bestId = pickBestProductMidiaId(imageRows, pedidoHint);
    return bestId ? imageRows.filter((row) => midiaRowId(row) === bestId).slice(0, 1) : [];
  }

  const candidateIds = scored.map((item) => midiaRowId(item.row)).filter(Boolean);
  const ranked = rankReferenceMidiaIds(candidateIds, imageRows, pedidoHint);
  const byId = new Map(imageRows.map((row) => [midiaRowId(row), row]));
  let ordered = ranked
    .map((id) => byId.get(id))
    .filter(Boolean)
    .slice(0, limit);
  const explicitHeroId = pickHeroProductMidiaId(searchPool.length ? searchPool : imageRows, pedidoHint);
  if (explicitHeroId) {
    const heroRow = byId.get(explicitHeroId);
    if (heroRow) {
      ordered = [heroRow, ...ordered.filter((row) => midiaRowId(row) !== explicitHeroId)].slice(0, limit);
    }
  }
  return ordered;
}

/**
 * Remove referências que não batem com o produto pedido; tenta auto-match no acervo.
 *
 * @param {Record<string, unknown>} proposal
 * @param {Array<Record<string, unknown>>} midiaRows
 * @param {string} userHint
 * @returns {Record<string, unknown>}
 */
export function reconcileProposalMidias(proposal, midiaRows, userHint) {
  const p = proposal && typeof proposal === "object" ? { ...proposal } : {};
  const spec = parseProductMentionSpec(userHint);
  if (spec.mode === "none") return p;

  const rows = Array.isArray(midiaRows) ? midiaRows : [];
  const byId = new Map(rows.map((r) => [String(r.id_midia ?? "").trim(), r]));
  const rawRefs = Array.isArray(p.midias_referenced) ? p.midias_referenced : [];

  const kept = rawRefs.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const id = typeof item.id_midia === "string" ? item.id_midia.trim() : "";
    const row = id ? byId.get(id) : null;
    if (!row) return false;
    return rowMatchesProductSpec(row, spec, 35);
  });

  const pickedRows = resolveMidiaRowsForPedido(rows, userHint, 3);
  if (pickedRows.length) {
    p.midias_referenced = pickedRows.map((row) => ({
      id_midia: String(row.id_midia ?? "").trim(),
      nome_exibicao: String(row.nome_exibicao ?? row.nome_arquivo ?? "Mídia").trim() || "Mídia",
      nome_arquivo: String(row.nome_arquivo ?? "").trim() || undefined,
      why: "PNG do acervo vinculado ao pedido.",
    }));
    return p;
  }

  if (kept.length) {
    p.midias_referenced = kept.slice(0, 3);
    return p;
  }

  const { pool } = narrowImageRowsByProductMention(
    rows.filter((r) => String(r.tipo_midia ?? "").trim().toLowerCase() === "imagem"),
    userHint,
  );
  const sorted = pool
    .map((row) => ({ row, score: scoreRowForProductSpec(row, spec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  p.midias_referenced = sorted.map(({ row, score }) => ({
    id_midia: String(row.id_midia ?? "").trim(),
    nome_exibicao: String(row.nome_exibicao ?? row.nome_arquivo ?? "Mídia").trim() || "Mídia",
    why:
      score >= 35
        ? `Acervo: nome/arquivo contém "${spec.terms.slice(0, 2).join('" / "')}" como no pedido.`
        : "Referência alinhada ao pedido.",
  }));

  return p;
}

/**
 * Remove referências de mídia que não batem com o pedido ativo (ex.: creatina no histórico, monster agora).
 *
 * @param {Record<string, unknown>} proposal
 * @param {Array<Record<string, unknown>>} midiaRows
 * @param {string} pedidoHint
 */
function rowForProposalRef(item, byId) {
  if (!item || typeof item !== "object") return null;
  const id = typeof item.id_midia === "string" ? item.id_midia.trim() : "";
  const catalog = id ? byId.get(id) : null;
  if (catalog) return catalog;
  const nome = String(item.nome_exibicao ?? "").trim();
  const arquivo = String(item.nome_arquivo ?? "").trim();
  if (!nome && !arquivo) return null;
  return {
    id_midia: id || null,
    nome_exibicao: nome,
    nome_arquivo: arquivo,
    alt_text: String(item.alt_text ?? "").trim(),
  };
}

export function pruneProposalMidiasToPedido(proposal, midiaRows, pedidoHint) {
  const p = proposal && typeof proposal === "object" ? { ...proposal } : {};
  const spec = parseProductMentionSpec(pedidoHint);
  if (spec.mode === "none") return p;

  const rows = Array.isArray(midiaRows) ? midiaRows : [];
  const byId = new Map(rows.map((r) => [String(r.id_midia ?? "").trim(), r]));
  const refs = Array.isArray(p.midias_referenced) ? p.midias_referenced : [];
  const kept = refs
    .filter((item) => {
      const row = rowForProposalRef(item, byId);
      return row ? rowMatchesProductSpec(row, spec, 35) : false;
    })
    .slice(0, 3);

  p.midias_referenced = kept;

  const heroId =
    p.hero_product && typeof p.hero_product === "object" && typeof p.hero_product.id_midia === "string"
      ? p.hero_product.id_midia.trim()
      : "";
  const heroStillValid = heroId && kept.some((item) => String(item?.id_midia ?? "").trim() === heroId);
  if (heroStillValid) return p;

  if (kept.length) {
    const first = kept[0];
    p.hero_product = {
      id_midia: String(first.id_midia ?? "").trim() || null,
      nome_exibicao: String(first.nome_exibicao ?? "Mídia").trim() || "Mídia",
      reason: "alinhado_ao_pedido_atual",
    };
  } else {
    p.hero_product = null;
  }
  return p;
}

/**
 * Filtra IDs de referência visual para só os que batem com o pedido ativo.
 *
 * @param {string[]} ids
 * @param {Array<Record<string, unknown>>} midiaRows
 * @param {string} pedidoHint
 */
export function filterReferenceMidiaIdsToPedido(ids, midiaRows, pedidoHint) {
  const list = Array.isArray(ids) ? ids : [];
  const spec = parseProductMentionSpec(pedidoHint);
  if (spec.mode === "none") return list;
  const byId = new Map(midiaRows.map((r) => [String(r.id_midia ?? "").trim(), r]));
  return list.filter((id) => {
    const row = byId.get(String(id ?? "").trim());
    return row ? rowMatchesProductSpec(row, spec, 35) : false;
  });
}

/**
 * @param {Record<string, unknown>} proposal
 * @param {Array<Record<string, unknown>>} midiaRows
 * @param {string} userHint
 * @param {Array<{ role: string, content: string }>} [history]
 */
export function applyProductMediaGate(proposal, midiaRows, userHint, _history = []) {
  let p = reconcileProposalMidias(proposal, midiaRows, userHint);
  p = pruneProposalMidiasToPedido(p, midiaRows, userHint);
  const check = checkProductMediaAvailability(userHint, midiaRows);

  if (!check.missing) {
    p.product_media_status = check.mentions.length ? "matched" : "not_requested";
    if (check.mentions.length) p.products_requested = check.mentions;
    return { proposal: p, blocked: false };
  }

  p.midias_referenced = [];
  p.hero_product = null;
  p.products_requested = check.mentions;
  p.product_media_status = "missing";
  p.frase_na_imagem = "";
  if (p.facts_for_image && typeof p.facts_for_image === "object") {
    delete p.facts_for_image.frase_na_imagem;
  }

  return {
    proposal: p,
    blocked: true,
    confirmation_message: buildMissingProductMediaMessage(check.mentions),
    missing_slots: ["midia_acervo"],
  };
}
