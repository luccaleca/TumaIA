/**
 * Vincula produtos do acervo ao que o cliente citou no pedido (ex.: "monster" ≠ "pro force morango").
 */


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
    .toLowerCase();
}

/** Remove espaços, hífens e pontuação — "pro-force" e "pro force" ficam iguais. */
export function compactProductKey(value) {
  return normalizeProductSearchText(value).replace(/[^a-z0-9]/g, "");
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
    const idx = h.indexOf(w, pos);
    if (idx < 0) return false;
    pos = idx + w.length;
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
  "naked wafer dark chocolate": [["dark"], ["chocolate"]],
  "naked wafer chocolate branco": [["branco"]],
  "naked wafer cinnamon": [["cinnamon", "canela"]],
  "naked wafer avela": [["avela"]],
  "creatina integral": [["integral"]],
  "creatina growth": [["growth"]],
  "creatina max": [["max"]],
};

/** Produto único no acervo (não é linha com sabores). */
const STANDALONE_SKU_PHRASES = new Set(["monster"]);

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
  const b = normalizeProductSearchText(blob);
  const compactB = compactProductKey(blob);
  return groups.every((group) =>
    group.some((token) => {
      if (b.includes(token)) return true;
      const ct = compactProductKey(token);
      return ct.length >= 3 && compactB.includes(ct);
    }),
  );
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

  let score = 0;

  if (b.includes(p)) score = 120 + p.length;
  else {
    const compactP = compactProductKey(p);
    const compactB = compactProductKey(b);
    if (compactP.length >= 4 && compactB.includes(compactP)) {
      score = 105 + compactP.length;
    } else {
      const words = p.split(" ").filter((w) => w.length >= 2);
      if (words.length >= 2 && tokensAppearInOrder(b, words)) {
        score = 90 + p.length;
      } else if (words.length === 1) {
        const single = words[0];
        if (b.includes(single)) score = 80 + single.length;
        else if (compactB.includes(compactProductKey(single))) score = 75 + single.length;
        else score = scoreTypoTokenInBlob(b, single);
      }
    }
  }

  if (score > 0 && phraseRequiresDiscriminators(p) && !discriminatorsSatisfiedInBlob(blob, p)) {
    return 0;
  }

  return score;
}

export function buildMidiaSearchBlob(row) {
  const raw = `${row?.nome_exibicao ?? ""} ${row?.nome_arquivo ?? ""} ${row?.descricao ?? ""} ${row?.alt_text ?? ""}`;
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
  return /\bwhey\b/.test(clause);
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

function extractWheyScopedPhrases(normalized) {
  if (!/\bwhey\b/.test(normalized)) return [];

  const phrases = new Set();
  const wheyClauses = splitPedidoClauses(normalized).filter(clauseMentionsWhey);
  const scope = wheyClauses.length ? wheyClauses : [normalized];

  const flavors = [];
  for (const clause of scope) {
    if (/\bcookies?\b/.test(clause) && !flavors.includes("cookies")) flavors.push("cookies");
    if (/\bchocolate\b/.test(clause) && !flavors.includes("chocolate")) flavors.push("chocolate");
    if (/\bbaunilha\b/.test(clause) && !flavors.includes("baunilha")) flavors.push("baunilha");
  }

  if (flavors.length) {
    for (const f of flavors) phrases.add(`whey growth ${f}`);
    return [...phrases];
  }

  const sharedCookie =
    /\bcookies?\b/.test(normalized) &&
    /\bwhey\b/.test(normalized) &&
    scope.some((c) => clauseMentionsWhey(c) && !/\bcookies?\b/.test(c));
  if (sharedCookie) {
    phrases.add("whey growth cookies");
    return [...phrases];
  }

  const sharedChocolate =
    /\bchocolate\b/.test(normalized) &&
    /\bwhey\b/.test(normalized) &&
    scope.some((c) => clauseMentionsWhey(c) && !/\bchocolate\b/.test(c)) &&
    !/\btudo\b/.test(normalized);
  if (sharedChocolate) {
    phrases.add("whey growth chocolate");
    return [...phrases];
  }

  if (scope.some((c) => /\bwhey\s+growth\b|\bgrowth\s+whey\b/.test(c)) || /\bwhey\b/.test(normalized)) {
    phrases.add("whey growth");
  }
  return [...phrases];
}

function extractNakedWaferScopedPhrases(normalized) {
  const barraClauses = splitPedidoClauses(normalized).filter(
    (c) => /\b(barra|barrinha|barras)\b/.test(c) || /\bnaked\b/.test(c),
  );
  const hasNaked =
    /\bnaked\s+wafer\b/.test(normalized) ||
    (/\b(barra|barrinha|barras)\b/.test(normalized) && /\bnaked\b/.test(normalized)) ||
    barraClauses.length > 0;

  if (!hasNaked) return [];

  const phrases = new Set();
  const scope = barraClauses.length ? barraClauses : [normalized];

  const pickFlavor = (clause) => {
    if (/\bdark\s+chocolate\b/.test(clause)) return "naked wafer dark chocolate";
    if (/\bchocolate\s+branco\b/.test(clause)) return "naked wafer chocolate branco";
    if (/\bcinnamon\b|\bcanela\b/.test(clause)) return "naked wafer cinnamon";
    if (/\bavela\b/.test(clause)) return "naked wafer avela";
    return null;
  };

  for (const clause of scope) {
    const flavor = pickFlavor(clause);
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
    if (/\bwhey\b/.test(normalized)) phrases.add("whey growth cookies");
    if (hasPf) phrases.add("pro force cookies");
  }

  if (chocolateIntent && (/\btudo\b/.test(normalized) || tudoFlavor === "chocolate")) {
    phrases.add("pro force chocolate");
    phrases.add("whey growth chocolate");
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
    const score = scorePhraseAgainstBlob(blob, phrase);
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

  if (score < minScore) return false;

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
 * @param {string[]} mentions
 */
export function buildMissingProductMediaMessage(mentions) {
  const labels = (mentions || []).slice(0, 2).map((m) => `«${m}»`).join(", ");
  const mais = mentions.length > 2 ? ` (+${mentions.length - 2})` : "";
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
    return { strict: false, mentions: [], matchedRows: [], missing: false };
  }
  const imageRows = (Array.isArray(midiaRows) ? midiaRows : []).filter(
    (row) => String(row.tipo_midia ?? "").trim().toLowerCase() === "imagem",
  );
  const { pool, strict } = narrowImageRowsByProductMention(imageRows, userHint);
  return {
    strict,
    mentions,
    matchedRows: pool,
    missing: strict && pool.length === 0,
  };
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
