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
  "sofisticado",
  "sofisticada",
  "vibrante",
  "vibrantes",
  "fotografia",
  "fotografico",
  "fotografica",
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
  "gym",
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
  [/\b(promo[cç][aã]o|promocional|promo\b|desconto|oferta)\b/i, "promocao"],
  [/\b(lancamento|novidade|estreia|lancar|lan[cç]ar)\b/i, "lancamento"],
  [/\b(anunciar|anuncio|divulga[cç][aã]o|divulgar|apresenta[cç][aã]o|apresentar)\b/i, "divulgacao"],
  [/\b(campanha)\b/i, "campanha"],
  [/\b(destaque)\b/i, "destaque"],
];

/** Vocabulário de domínio → rótulo canônico (não é catálogo de frases). */
const SCENARIO_WORDS = [
  ["praia", "praia"],
  ["academia", "academia"],
  ["academias", "academia"],
  ["treino", "academia"],
  ["fitness", "academia"],
  ["gym", "academia"],
  ["estudio", "estúdio"],
  ["studio", "estúdio"],
  ["cozinha", "cozinha"],
  ["mesa", "mesa"],
  ["rua", "rua"],
  ["parque", "parque"],
  ["ginasio", "ginásio"],
  ["natureza", "natureza"],
  ["corrida", "corrida"],
  ["asfalto", "asfalto"],
  ["noite", "noite"],
];

/** Operadores de mutação de estado (classe fechada — não verbos de colocação). */
const STATE_MUTATION_RE =
  /\b(troca|troque|muda|mude|altera|alterar|esquece|esqueca|tira|remove|agora|em\s+vez|no\s+lugar|substitui|substitua|mantem|so\s+muda)\b/;

/** Verbos que introduzem objeto (produto/cenário), não apagam briefing sozinhos. */
const PLACEMENT_VERB_RE = /\b(bota|botar|coloca|colocar|poe|ponha|usa|usar|inclui|incluir)\b/;

/** Tokens que nunca são produto (verbos/operadores/ruído). */
const PRODUCT_STOP_TOKENS = new Set([
  "produto",
  "parecer",
  "fotografia",
  "real",
  "verdade",
  "cara",
  "algo",
  "mais",
  "bem",
  "faz",
  "fazer",
  "quero",
  "vende",
  "vender",
  "coloca",
  "colocar",
  "deixa",
  "deixar",
  "muda",
  "mudar",
  "troca",
  "trocar",
  "agora",
  "apar",
  "aparencia",
  "aparencias",
  "visual",
  "estilo",
  "aspecto",
  "inclui",
  "incluir",
  "evidencia",
  "evidenciar",
  "esquece",
  "poe",
  "ambiente",
  "cenario",
  "clima",
  "aquele",
  "aquela",
  "daquele",
  "daquela",
  "isso",
  "isto",
  "coisa",
  "item",
  "tem",
  "que",
  "chamar",
  "atencao",
  "atencao",
  "arte",
  "peca",
  "post",
  "imagem",
  "foto",
  "cliente",
  "pular",
  "gritando",
  "luxo",
  "sobe",
  "valor",
  "preco",
  "oferta",
  "custo",
  "custa",
  "pra",
  "para",
  "por",
  "pro",
  "com",
  "pode",
  "ser",
  "nessa",
  "nisso",
  "espaco",
  "espacos",
  "chamada",
  "chamadas",
  "lancamento",
  "vibe",
  "elementos",
  "elemento",
  "usando",
  "remetam",
  "moderno",
  "moderna",
  "chamativo",
  "chamativa",
  "esportiva",
  "esportivo",
  "agressiva",
  "agressivo",
  "estetica",
  "cadastrei",
  "cadastrada",
  "cadastrado",
  "correto",
  "errada",
  "errado",
]);

/** Palavras que fecham uma unidade de cenário (não pertencem ao lugar). */
const SCENARIO_CHUNK_STOP = new Set([
  "e",
  "o",
  "a",
  "os",
  "as",
  "com",
  "mas",
  "preco",
  "precos",
  "valor",
  "valores",
  "oferta",
  "desconto",
  "promo",
  "promocao",
  "promocional",
  "bem",
  "algo",
  "mais",
  "deixe",
  "deixa",
  "coloca",
  "espaco",
  "destaque",
  "destacado",
  "destacada",
  "moderno",
  "profissional",
  "sofisticado",
  "estilo",
  "visual",
  "arte",
  "foto",
  "imagem",
  "post",
]);

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
    /\b(monta|montar|cria|criar|gera|gerar|preciso|precisa|quero|faz|fazer|deixa|deixe|coloca|troca|muda|agora|foto|fotos|arte|post|banner|valor|preco|precos|promocao|promocoes|promo|campanha|oferta|desconto|estilo|estetica|visual|fundo|background|algo|uma|umas|uns|um|evidencia|destaque|grandes?|maior|aparentes?|tematica|tematicas|tema|cima|produto|produtos|sabor|sabores|lancamento|lancar|divulgar|divulgacao|anunciar|anuncio|versao|realista|premium|clean|inverno|verao|praia|academia|festa|junina|gym|treino|fitness|frente|me)\b/gi,
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
/** Tokens de meta-conversa / fechamento — nunca nome de produto sozinhos. */
const FLOW_META_TOKENS = new Set([
  "ok",
  "okay",
  "beleza",
  "blz",
  "fechou",
  "fechar",
  "confirma",
  "confirme",
  "confira",
  "resumo",
  "painel",
  "montar",
  "monta",
  "gerar",
  "gera",
  "criar",
  "cria",
  "seguir",
  "continuar",
  "continua",
  "pronto",
  "vamos",
  "pode",
  "manda",
  "vai",
  "isso",
  "sim",
  "nao",
  "valeu",
  "obrigado",
  "obrigada",
]);

/**
 * @param {string} raw
 */
export function looksLikeProductCandidate(raw) {
  const n = normalizeCreationText(raw);
  if (!n || n.length < 3) return false;
  if (isVisualStyleTerm(n) || isThemeNoiseTerm(n)) return false;
  if (
    /^(uma|um|uns|umas|de|do|da|cao|acao|algo|isso|esse|essa|disso|desse|dessa|daquilo|aquilo|aquele|aquela|isto)\b/.test(
      n,
    )
  ) {
    return false;
  }
  // Só demonstrativo / referência vazia ("o outro", "o novo", "o de cima").
  if (/^(o|a)\s+(outro|outra|novo|nova|segundo|segunda|cima|baixo|mesmo|mesma)\b/.test(n)) {
    return false;
  }
  const words = n.split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  if (words.every((w) => w.length <= 2 || ["de", "do", "da", "com", "por"].includes(w))) {
    return false;
  }
  // Meta de fluxo ("ok resumo", "montar painel") não é mercadoria.
  const contentWords = words.filter((w) => !FLOW_META_TOKENS.has(w));
  if (!contentWords.length) return false;
  if (contentWords.every((w) => w.length <= 2)) return false;
  return true;
}

/**
 * Utterance de fechamento/aprovação do fluxo (sem nomear mercadoria).
 * Estrutura linguística — não lista de produtos/marcas.
 * @param {string} raw
 */
export function isCreationFlowMetaUtterance(raw) {
  const n = normalizeCreationText(raw)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!n || n.length > 80) return false;
  const words = n.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 10) return false;

  const hasProceed =
    /^(ok|okay|beleza|blz|fechou|sim|isso|valeu|pronto)\b/.test(n) ||
    /\b(pode|vamos|manda|vai)\s+(montar|gerar|criar|seguir|continuar|fechar|fazer)\b/.test(n) ||
    /\b(montar|gera[r]?|cria[r]?)\s+(o\s+)?(resumo|painel|arte|post)\b/.test(n) ||
    /\bconfirma(r|do|da)?\b/.test(n);

  if (!hasProceed) return false;

  const stripped = words
    .filter((w) => !FLOW_META_TOKENS.has(w))
    .filter((w) => !["o", "a", "os", "as", "um", "uma", "de", "do", "da", "no", "na"].includes(w))
    .join(" ")
    .trim();
  if (!stripped) return true;
  return !looksLikeProductCandidate(stripped);
}

/** Sufixo de arquivo com UUID (completo ou truncado): `.png--uuid` ou `.png-uuid`. */
const SLASH_FILE_MIDIA_RE =
  /\/([^\s/]+?)\.(?:png|jpe?g|webp|gif|avif|bmp|svg)(?:-{1,2}([0-9a-f][0-9a-f-]{5,}))?/gi;

/**
 * Referências explícitas `/arquivo.ext-UUID` (ou `--UUID`) do menu/acervo.
 * @param {string} raw
 * @returns {Array<{ productName: string, idHint: string | null }>}
 */
export function extractSlashMidiaRefsFromText(raw) {
  const text = String(raw || "");
  const out = [];
  const re = new RegExp(SLASH_FILE_MIDIA_RE.source, "gi");
  let m;
  while ((m = re.exec(text))) {
    const productName = String(m[1] || "")
      .replace(/[-_]+/g, " ")
      .trim();
    const idHint = String(m[2] || "")
      .trim()
      .replace(/-+$/g, "")
      .toLowerCase();
    if (!productName && !idHint) continue;
    if (productName && isVisualStyleTerm(productName) && !idHint) continue;
    out.push({
      productName: productName || "",
      idHint: idHint.length >= 8 ? idHint : null,
    });
  }
  return out;
}

/**
 * Normaliza hint de UUID (pode vir truncado no chip/texto).
 * @param {string} hint
 */
export function normalizeSlashMidiaIdHint(hint) {
  return String(hint || "")
    .trim()
    .toLowerCase()
    .replace(/-+$/g, "");
}

/**
 * Resolve hints de UUID (exatos ou prefixo) contra linhas do acervo.
 * @param {string[]} idHints
 * @param {Array<{ id_midia?: unknown }>} midiaRows
 * @returns {string[]}
 */
export function resolveSlashMidiaIdsAgainstRows(idHints, midiaRows) {
  const rows = Array.isArray(midiaRows) ? midiaRows : [];
  const byId = new Map(
    rows
      .map((r) => {
        const id = String(r?.id_midia ?? "").trim();
        return id ? [id.toLowerCase(), id] : null;
      })
      .filter(Boolean),
  );
  const resolved = [];
  for (const rawHint of idHints || []) {
    const hint = normalizeSlashMidiaIdHint(rawHint);
    if (!hint || hint.length < 8) continue;
    const exact = byId.get(hint);
    if (exact) {
      if (!resolved.includes(exact)) resolved.push(exact);
      continue;
    }
    const matches = [...byId.entries()]
      .filter(([id]) => id.startsWith(hint))
      .map(([, original]) => original);
    if (matches.length === 1 && !resolved.includes(matches[0])) {
      resolved.push(matches[0]);
    }
  }
  return resolved;
}

/**
 * Junta `reference_midia_ids` do body com UUIDs parseados do texto/histórico.
 * @param {string[]} existingIds
 * @param {string | Array<{ role?: string, content?: string }>} textOrHistory
 * @param {Array<{ id_midia?: unknown }>} midiaRows
 * @returns {string[]}
 */
export function mergeReferenceMidiaIdsFromSlashText(existingIds, textOrHistory, midiaRows) {
  const base = [
    ...new Set(
      (Array.isArray(existingIds) ? existingIds : [])
        .map((x) => String(x || "").trim())
        .filter(Boolean),
    ),
  ];
  const texts = [];
  if (typeof textOrHistory === "string") {
    texts.push(textOrHistory);
  } else if (Array.isArray(textOrHistory)) {
    for (const m of textOrHistory) {
      if (m?.role === "user" && typeof m.content === "string" && m.content.trim()) {
        texts.push(m.content);
      }
    }
  }
  const hints = [];
  for (const t of texts) {
    for (const ref of extractSlashMidiaRefsFromText(t)) {
      if (ref.idHint) hints.push(ref.idHint);
    }
  }
  const fromText = resolveSlashMidiaIdsAgainstRows(hints, midiaRows);
  return [...new Set([...base, ...fromText])].slice(0, 4);
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function extractSlashProductCommands(raw) {
  const text = String(raw || "");
  const out = [];
  for (const ref of extractSlashMidiaRefsFromText(text)) {
    if (ref.productName && !isVisualStyleTerm(ref.productName)) out.push(ref.productName);
  }
  const reCmd = /(^|\s)\/([a-z0-9][\w-]{1,40})\b/gi;
  let m;
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
  if (
    /\b(fotografia|foto)\s+real\b/.test(n) ||
    (/\bfotografia\b/.test(n) && /\breal\b/.test(n)) ||
    /\b(cara\s+de\s+)?(foto|fotografia)\s+(de\s+)?(verdade|real)\b/.test(n) ||
    /\bfoto\s+de\s+verdade\b/.test(n)
  ) {
    if (!hits.includes("photorealistic")) hits.push("photorealistic");
  }
  if (/\bmais\s+real\b/.test(n) && !hits.includes("realista")) hits.push("realista");
  if (/\bmais\s+(bonito|profissional|premium|clean|vibrante)\b/.test(n)) {
    const m = n.match(/\bmais\s+(bonito|profissional|premium|clean|vibrante)\b/);
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
 * Mascara unidades comerciais (preço/oferta) para não vazarem em cenário/tema.
 * Abordagem semântica: trata "R$ 79,90" / "preço de …" como um bloco, não palavras soltas.
 * @param {string} raw
 */
export function maskCommercialSemanticUnits(raw) {
  let t = String(raw || "");
  t = t.replace(
    /\b(?:pre[cç]os?|valor(?:es)?|oferta)\s+(?:de\s+|do\s+|da\s+|em\s+)?(?:r\$\s*)?\d{1,6}(?:[.,]\d{1,2})?\b/gi,
    " «OFERTA» ",
  );
  t = t.replace(/\br\$\s*\d{1,6}(?:[.,]\d{1,2})?\b/gi, " «OFERTA» ");
  t = t.replace(
    /\b(?:por|a|em)\s+(?:r\$\s*)?\d{1,6}(?:[.,]\d{1,2})?(?:\s*reais?)?\b/gi,
    " «OFERTA» ",
  );
  t = t.replace(/\b\d{1,6}(?:[.,]\d{1,2})?\s*reais?\b/gi, " «OFERTA» ");
  t = t.replace(
    /\b(?:valor|pre[cç]o)\b[\s\S]{0,48}?\bé\s+(?:r\$\s*)?\d{1,6}(?:[.,]\d{1,2})?\b/gi,
    " «OFERTA» ",
  );
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Quantias com forma de dinheiro (unidade semântica), independentemente da preposição.
 * @param {string} normalized
 * @returns {string[]}
 */
export function extractMoneyShapedAmounts(normalized) {
  const t = String(normalized || "");
  const out = [];
  for (const m of t.matchAll(/\br\$\s*(\d{1,6}(?:[.,]\d{1,2})?)\b/gi)) {
    if (m[1]) out.push(m[1]);
  }
  for (const m of t.matchAll(/\b(\d{1,6}[.,]\d{2})\b/g)) {
    if (m[1] && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/**
 * Classe fechada: há mutação de briefing (não inventário de frases).
 * @param {string} raw
 */
export function hasStateMutationOperator(raw) {
  return STATE_MUTATION_RE.test(normalizeCreationText(raw));
}

/**
 * Relação de substituição de produto: (origem) → (destino).
 * Estrutura linguística, não frases fixas.
 * @param {string} raw
 * @returns {{ from: string, to: string } | null}
 */
export function detectProductSubstitution(raw) {
  const n = normalizeCreationText(raw);
  if (!n) return null;

  const pairPatterns = [
    /\bem\s+vez\s+(?:de\s+|do\s+|da\s+)?([a-z0-9][a-z0-9-]{2,40})\s*[,.]?\s*(?:usa|usar|coloca|poe|bota|faz(?:\s+com)?|vai(?:\s+de)?|fica(?:\s+com)?|com)?\s*(?:a\s+|o\s+|da\s+|do\s+)?([a-z0-9][a-z0-9-]{2,40}(?:\s+[a-z0-9][a-z0-9-]{2,40}){0,2})\b/,
    /\bno\s+lugar\s+(?:de\s+|do\s+|da\s+)?([a-z0-9][a-z0-9-]{2,40})\s*[,.]?\s*(?:usa|usar|coloca|poe|bota|faz(?:\s+com)?|vai|fica|com)?\s*(?:a\s+|o\s+|da\s+|do\s+)?([a-z0-9][a-z0-9-]{2,40}(?:\s+[a-z0-9][a-z0-9-]{2,40}){0,2})\b/,
    /\b(?:substitui|substitua|troca|troque)\s+(?:o\s+|a\s+)?(?:da\s+|do\s+)?([a-z0-9][a-z0-9-]{2,40})\s+(?:por|pra|pelo|pela|para|pro)\s+(?:a\s+|o\s+|da\s+|do\s+)?([a-z0-9][a-z0-9-]{2,40}(?:\s+[a-z0-9][a-z0-9-]{2,40}){0,2})\b/,
  ];
  for (const re of pairPatterns) {
    const m = n.match(re);
    if (!m?.[1] || !m?.[2]) continue;
    const from = refineProductQuery(m[1]);
    const to = refineProductQuery(m[2]);
    if (to && looksLikeProductCandidate(to) && to !== from) {
      return { from: from || m[1], to };
    }
  }

  const onlyTo = n.match(
    /\b(?:substitui|substitua|troca|troque)\s+(?:pelo|pela|pra|por|para|pro)\s+(?:da\s+|do\s+|a\s+|o\s+)?([a-z0-9][a-z0-9-]{2,40})\b/,
  );
  if (onlyTo?.[1]) {
    const to = refineProductQuery(onlyTo[1]);
    if (to && looksLikeProductCandidate(to)) return { from: "", to };
  }
  return null;
}

/**
 * Operação do turno sobre o estado acumulado.
 * @param {string} raw
 * @param {ReturnType<typeof parseCreationTurn>} turn
 * @param {CreationState | null} [prev]
 */
export function classifyCreationOperation(raw, turn, prev = null) {
  const n = normalizeCreationText(raw);
  if (isCreationFlowMetaUtterance(raw) && prev?.produto) {
    return {
      type: /** @type {const} */ ("patch"),
      product: "",
      suppressNoisyProduct: true,
    };
  }
  const sub = turn?.substitution?.to
    ? turn.substitution
    : detectProductSubstitution(raw);
  if (sub?.to) {
    return {
      type: /** @type {const} */ ("replace_product"),
      product: sub.to,
      suppressNoisyProduct: true,
    };
  }

  // Troca intencional de produto (ex.: "agora faz com a creatina").
  const intentionalSwitch =
    turn?.productQuery &&
    looksLikeProductCandidate(turn.productQuery) &&
    !PRODUCT_STOP_TOKENS.has(normalizeCreationText(turn.productQuery)) &&
    /\b((faz\s+)?com\s+(a\s+|o\s+)?|usa\s+(a\s+|o\s+)?|usar\s+|vai\s+de\s+|fica\s+com\s+)\b/.test(
      n,
    );
  if (intentionalSwitch) {
    return {
      type: /** @type {const} */ ("replace_product"),
      product: turn.productQuery,
      suppressNoisyProduct: true,
    };
  }

  const mutating = hasStateMutationOperator(raw) || Boolean(turn?.isRevisionOnly);
  const hasFieldPatch = Boolean(
    turn?.offer ||
      turn?.scenario ||
      turn?.theme ||
      turn?.layout ||
      (turn?.style && turn.style.length) ||
      turn?.flavor ||
      turn?.characteristic,
  );
  const prevHasBrief = Boolean(prev && (prev.produto || hasCreationAttributes(prev)));

  if (mutating && hasFieldPatch) {
    return {
      type: /** @type {const} */ ("patch"),
      product: null,
      suppressNoisyProduct: true,
    };
  }
  if (prevHasBrief && hasFieldPatch && !turn?.productQuery) {
    return {
      type: /** @type {const} */ ("patch"),
      product: null,
      suppressNoisyProduct: true,
    };
  }
  if (prevHasBrief && hasFieldPatch && turn?.productQuery) {
    // Produto ruidoso em patch de preço/cenário/estilo: preservar o anterior.
    if (PRODUCT_STOP_TOKENS.has(normalizeCreationText(turn.productQuery))) {
      return {
        type: /** @type {const} */ ("patch"),
        product: null,
        suppressNoisyProduct: true,
      };
    }
  }
  if (mutating && prevHasBrief && !turn?.slashProducts?.length && !turn?.productQuery) {
    return {
      type: /** @type {const} */ ("patch"),
      product: null,
      suppressNoisyProduct: true,
    };
  }

  return {
    type: /** @type {const} */ ("set"),
    product: turn?.productQuery || null,
    suppressNoisyProduct: false,
  };
}

/**
 * @param {string} raw
 */
export function extractOfferFromText(raw) {
  // Dimensões (1080x1080, 1920×1080) não são oferta "N por R$N".
  // Normaliza acentos: "é" → "e" (em JS `\bé` falha — é não é \w).
  // "pro 69,90" (coloquial de "por") entra na mesma classe preposicional.
  let t = normalizeCreationText(String(raw || "").replace(/\b\d{3,4}\s*[x×]\s*\d{3,4}\b/gi, " "));
  t = t.replace(/\bpro\s+(?=\d)/g, "por ");

  const multi = t.match(
    /(\d+)\s*(?:por|p\/|x)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?).{0,40}?(\d+)\s*(?:por|p\/|x)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i,
  );
  if (multi) {
    return `${multi[1]} por R$${multi[2]} / ${multi[3]} por R$${multi[4]}`
      .replace(/R\$\s*/g, "R$")
      .slice(0, 120);
  }
  const ePairs = [...t.matchAll(/(\d+)\s*(?:e|eh|=)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/gi)];
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
  if (fromTo) {
    const a = Number(String(fromTo[1]).replace(",", "."));
    const b = Number(String(fromTo[2]).replace(",", "."));
    if (Number.isFinite(a) && Number.isFinite(b) && a !== b) {
      return `de R$${fromTo[1]} por R$${fromTo[2]}`;
    }
  }
  const labeled = t.match(
    /\b(?:precos?|valor(?:es)?|ofertas?)\s+(?:de\s+|do\s+|da\s+|em\s+)?(?:r\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)\b/i,
  );
  if (labeled?.[1]) return `R$${labeled[1]}`.replace(/R\$\s*/g, "R$");
  const valorE = t.match(
    /\b(?:valor|preco|oferta)\b[\s\S]{0,48}?\be\s+(?:r\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)\b/i,
  );
  if (valorE?.[1]) return `R$${valorE[1]}`.replace(/R\$\s*/g, "R$");
  // "79,90 e o preco" / "e o preco do … 79,90" — preço após ou antes do rótulo.
  const priceIs = t.match(
    /\b(\d{1,6}(?:[.,]\d{1,2})?)\s+e\s+o\s+(?:preco|valor|custo)\b/i,
  );
  if (priceIs?.[1]) return `R$${priceIs[1]}`.replace(/R\$\s*/g, "R$");
  const currency = t.match(/\br\$\s*(\d{1,6}(?:[.,]\d{1,2})?)\b/i);
  if (currency?.[1]) return `R$${currency[1]}`.replace(/R\$\s*/g, "R$");
  const sellFor = t.match(
    /\b(?:por|a|em)\s+(?:r\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)(?:\s*reais?)?\b/i,
  );
  if (sellFor?.[1]) {
    const n = Number(String(sellFor[1]).replace(",", "."));
    if (Number.isFinite(n) && (n >= 10 || /[.,]\d{1,2}/.test(sellFor[1]))) {
      return `R$${sellFor[1]}`.replace(/R\$\s*/g, "R$");
    }
  }

  // Fallback semântico: quantia com forma de dinheiro (= oferta), sem exigir preposição.
  const amounts = extractMoneyShapedAmounts(t);
  if (amounts.length) {
    const pick = amounts[amounts.length - 1];
    const commercialCue =
      /\b(preco|valor|oferta|custa|custo|reais?|promo|desconto|arte|peca|post|imagem|destaque|comercial)\b/.test(
        t,
      ) || hasStateMutationOperator(t);
    if (/[.,]\d{2}$/.test(pick) || commercialCue) {
      return `R$${pick}`.replace(/R\$\s*/g, "R$");
    }
  }
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
 * @param {string} chunkNorm
 */
function resolveScenarioLabelFromChunk(chunkNorm) {
  const words = String(chunkNorm || "")
    .split(/\s+/)
    .filter(Boolean);
  const kept = [];
  for (const w of words) {
    if (SCENARIO_CHUNK_STOP.has(w)) break;
    if (/^\d/.test(w) || w.includes("«") || w === "oferta" || w === "preco") break;
    kept.push(w);
    const hit = SCENARIO_WORDS.find(([token]) => token === w);
    if (hit) return hit[1];
    if (kept.length >= 2) break;
  }
  if (!kept.length) return "";
  // Só aceita cenário se bater em vocabulário conhecido — evita virar "Academia o Preco".
  const joined = kept.join(" ");
  for (const [token, label] of SCENARIO_WORDS) {
    if (joined === token || kept[0] === token) return label;
  }
  return "";
}

/**
 * @param {string} raw
 */
export function extractScenarioFromText(raw) {
  // Preço/oferta mascarados: "fundo de academia e o preço de R$…" → cenário = academia.
  const n = normalizeCreationText(maskCommercialSemanticUnits(raw));
  if (!n) return "";

  const fundo = n.match(/\bfundo\s+(?:de\s+|da\s+|do\s+|com\s+)?([a-z0-9][a-z0-9\s-]{0,40})/);
  if (fundo?.[1]) {
    const label = resolveScenarioLabelFromChunk(fundo[1]);
    if (label) return label;
  }
  const ambiente = n.match(
    /\b(?:ambiente|cenario|clima)\s+(?:de\s+|da\s+|do\s+|com\s+|pra\s+|para\s+|pro\s+)?([a-z0-9][a-z0-9\s-]{0,40})/,
  );
  if (ambiente?.[1]) {
    const label = resolveScenarioLabelFromChunk(ambiente[1]);
    if (label) return label;
  }
  if (/\b(?:numa|em\s+uma|em\s+um|num)\s+academia\b/.test(n) || /\bna\s+academia\b/.test(n)) {
    return "academia";
  }
  if (/\bao\s+fundo\b/.test(n)) {
    for (const [token, label] of SCENARIO_WORDS) {
      if (n.includes(token)) return label;
    }
  }

  // Coleta cenários na ordem de aparição; em mutação, o último vence.
  const ordered = [];
  const reAll = new RegExp(
    `\\b(${SCENARIO_WORDS.map(([t]) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "g",
  );
  let m;
  while ((m = reAll.exec(n))) {
    const hit = SCENARIO_WORDS.find(([token]) => token === m[1]);
    if (hit) ordered.push(hit[1]);
  }
  if (ordered.length > 1 && hasStateMutationOperator(raw)) {
    return ordered[ordered.length - 1];
  }
  if (ordered.length) return ordered[0];
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
  const hasPriceUnit =
    /\b(precos?|valor(?:es)?|oferta|r\$|«oferta»)\b/.test(n) ||
    /\b\d{1,6}(?:[.,]\d{1,2})?\b/.test(n);
  const priceEmphasis =
    /\b(destacad[oa]s?|destaque|chamando|chamativ\w*|aten[cç][aã]o|evidenci\w*|aparent\w*|grandes?|maior|visiv\w*|bem\s+grande|bem\s+aparent|espaco\s+para\s+o\s+preco|gritando|pular|cara\s+do|bem\s+claro|no\s+destaque|em\s+evidencia)\b/.test(
      n,
    );
  if (hasPriceUnit && priceEmphasis) {
    bits.push("preço em destaque");
  } else if (/\bpreco\s+(maior|grande|em\s+evid)/.test(n)) {
    bits.push("preço em destaque");
  }
  if (/\bdestaca\s+que\b/.test(n) || (/\bem\s+destaque\b/.test(n) && !hasPriceUnit)) {
    const char = extractCharacteristicFromText(raw);
    if (char) bits.push(`destacar ${char}`);
  }
  if (/\btroca\s+o\s+fundo\b/.test(n)) bits.push("trocar fundo");
  if (/\bespaco\s+para\s+(o\s+)?(preco|valor|oferta)\b/.test(n)) {
    if (!bits.includes("preço em destaque")) bits.push("espaço para o preço");
  }
  return bits.join("; ").slice(0, 160);
}

/**
 * @param {string} raw
 */
export function extractCompositionFromText(raw) {
  const n = normalizeCreationText(maskCommercialSemanticUnits(raw));
  if (!n) return "";
  const bits = [];
  if (/\b(em\s+cima|acima)\s+(do|da)\s+produto\b/.test(n)) {
    bits.push("elementos acima do produto");
  }
  if (/\bao\s+fundo\b/.test(n) || /\bfundo\s+de\b/.test(n) || /\bambiente\s+de\b/.test(n)) {
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
  // Campanha/lançamento/divulgação explícitos vencem menção incidental a «oferta»/«destaque».
  if (/\bcampanha\b/.test(n)) return "campanha";
  if (/\b(lancamento|novidade|estreia|lancar|lan[cç]ar)\b/.test(n)) return "lancamento";
  if (/\b(anunciar|anuncio|divulga[cç][aã]o|divulgar|apresenta[cç][aã]o|apresentar)\b/.test(n)) {
    return "divulgacao";
  }
  if (/\b(promo[cç][aã]o|promocional|promo\b|desconto)\b/.test(n) || /\barte\s+promocional\b/.test(n)) {
    return "promocao";
  }
  // «oferta» sozinha pode ser o objeto comercial, não a intenção — só conta se for pedido de promo.
  if (/\b(fazer|faz|quero|cria|montar)\b/.test(n) && /\boferta\b/.test(n) && !/\bno\s+destaque\b/.test(n)) {
    return "promocao";
  }
  if (/\b(preciso|quero)\s+de\s+(uma\s+)?(foto|arte|imagem)\b/.test(n)) return "arte";
  if (/\b(foto|arte|imagem)\s+do\s+produto\b/.test(n)) return "arte";
  return "";
}

/**
 * Referência vaga a produto (precisa perguntar — não inventar).
 * @param {string} raw
 */
export function isVagueProductReference(raw) {
  const n = normalizeCreationText(raw);
  if (!n) return false;
  if (extractSlashProductCommands(raw).length) return false;
  // Demonstrativo + substantivo concreto (não «produto/item/coisa») → referência resolvível.
  if (
    /\b(desse|dessa|daquele|daquela|desse|desse|esse|essa|este|esta|aquele|aquela)\s+(?!produto\b|item\b|coisa\b)[a-z0-9][a-z0-9-]{2,}/.test(
      n,
    )
  ) {
    return false;
  }
  if (/\b(daquele|aquele|aquela|esse|essa|este|esta|desse|dessa)\s+(produto|item|coisa)\b/.test(n)) {
    return true;
  }
  if (/\b(produto|item)\s+novo\b/.test(n)) return true;
  if (/\b(produto|item)\s+(que|qual)\b/.test(n)) return true;
  if (/\b(daquela|aquela|aquele|daquele)\s+coisa\b/.test(n)) return true;
  if (/\bcoisa\s+la\b/.test(n)) return true;
  // Só demonstrativo, sem nome em seguida.
  if (/^(faz|quero|divulga|monta)?\s*(uma\s+arte\s+)?(disso|desse|dessa|daquilo|aquilo)\s*$/.test(n)) {
    return true;
  }
  return false;
}

/**
 * Limpa chunk de produto: tira demonstrativos e corta em cenário/preço.
 * @param {string} rawQuery
 */
export function refineProductQuery(rawQuery) {
  let q = normalizeCreationText(rawQuery);
  if (!q) return "";
  q = q
    .replace(
      /^(desse|dessa|deste|desta|esse|essa|este|esta|daquele|daquela|aquele|aquela|o|a|do|da|dos|das|um|uma)\s+/g,
      "",
    )
    .replace(/\b(novo|nova)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Demonstrativo + quantia ("aquele 79,90") não é produto.
  if (/^\d/.test(q) || extractMoneyShapedAmounts(q).length) return "";
  q = q.replace(
    /\s+(na|no|numa|num|em|com|por|para|pra|e|de)\s+(academia|praia|estudio|studio|fundo|preco|valor|oferta|r\$|promo|campanha|arte|foto|imagem|aparencia|gym|treino|frente).*$/i,
    "",
  );
  // Não cortar em "na/no" genérico — apagava o produto em "… na arte do whey".
  const words = q
    .split(/\s+/)
    .filter(
      (w) =>
        w &&
        !PRODUCT_STOP_TOKENS.has(w) &&
        !isVisualStyleTerm(w) &&
        !isThemeNoiseTerm(w) &&
        !/^(na|no|num|numa|me|frente)$/.test(w),
    );
  q = words.join(" ").trim();
  if (!q || PRODUCT_STOP_TOKENS.has(q) || isVagueProductReference(q)) return "";
  if (!looksLikeProductCandidate(q)) return "";
  return q;
}

/**
 * @param {string} raw
 */
export function extractExplicitProductHints(raw) {
  const slash = extractSlashProductCommands(raw);
  const n = normalizeCreationText(raw);
  const hints = [...slash];

  if (isVagueProductReference(raw)) {
    return [...new Set(hints.map((h) => refineProductQuery(h) || h).filter((h) => h.length >= 2))];
  }

  const sub = detectProductSubstitution(raw);
  if (sub?.to) {
    return [sub.to];
  }

  // Demonstrativos / artigo+nome / objeto de verbo de colocação.
  const patterns = [
    /\b(?:desse|dessa|deste|desta|esse|essa|este|esta)\s+([a-z0-9][a-z0-9-]{2,40})\b/i,
    /\b(?:do|da|dos|das)\s+([a-z0-9][a-z0-9-]{2,40})\b/i,
    /\b(?:o|a)\s+([a-z0-9][a-z0-9-]{2,40})\s+(?:a|por|pra|pro|na|no|com|em)\b/i,
    /\b(?:bota|botar|coloca|colocar|poe|ponha|usa|usar)\s+(?:o\s+|a\s+)?([a-z0-9][a-z0-9-]{2,40})\b/i,
    /\bagora\s+(?:faz\s+)?(?:com\s+)(?:a\s+|o\s+)?([a-z0-9][a-z0-9-]{2,40})\b/i,
    /\b(?:faz\s+)?(?:com\s+)(?:a\s+|o\s+)?([a-z0-9][a-z0-9-]{2,40})\b/i,
    /\bproduto\s+(?!photoreal|realistic|premium|clean|minimal|luxury|novo|nova)([a-z0-9][a-z0-9\s-]{1,40})/i,
  ];
  for (const re of patterns) {
    for (const m of n.matchAll(new RegExp(re.source, "gi"))) {
      if (!m?.[1]) continue;
      if (/^(r\$|aparencia|aparencias|visual|estilo|aspecto|preco|valor|oferta)\b/i.test(m[1])) {
        continue;
      }
      if (extractOfferFromText(m[1]) || /^[\d.,\s$r]+$/i.test(m[1])) continue;
      if (PRODUCT_STOP_TOKENS.has(normalizeCreationText(m[1]))) continue;
      const cleaned = refineProductQuery(stripCreationNoiseForProductSearch(m[1]) || m[1]);
      if (cleaned && looksLikeProductCandidate(cleaned)) hints.push(cleaned);
    }
  }

  // Preferir candidato mais “nome de produto” (não preposição residual).
  const ranked = [
    ...new Set(
      hints
        .map((h) => refineProductQuery(h) || h)
        .filter((h) => h.length >= 2 && !PRODUCT_STOP_TOKENS.has(normalizeCreationText(h))),
    ),
  ].sort((a, b) => {
    const score = (x) =>
      (/\b(whey|creatina|monster|powerade|cafe|barra|proteina)\b/i.test(x) ? 20 : 0) +
      x.length -
      (PRODUCT_STOP_TOKENS.has(x) ? 50 : 0);
    return score(b) - score(a);
  });

  if (!ranked.length) {
    const only = refineProductQuery(stripCreationNoiseForProductSearch(raw));
    const words = only.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 4) {
      const joined = words.join(" ");
      if (
        looksLikeProductCandidate(joined) &&
        !PRODUCT_STOP_TOKENS.has(joined) &&
        !extractIntentFromText(raw) &&
        !extractOfferFromText(raw) &&
        !extractStyleTermsFromText(raw).length &&
        !extractThemeFromText(raw) &&
        !extractFlavorFromText(raw) &&
        !hasStateMutationOperator(raw) &&
        !/\b(quero|faz|deixa|monta|promo|post|arte|tema|sabor|pode)\b/i.test(n)
      ) {
        ranked.push(joined);
      }
    }
  }

  return ranked;
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
  if (isCreationFlowMetaUtterance(t)) return true;
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
  if (isCreationFlowMetaUtterance(text)) {
    return {
      slashProducts: [],
      productHints: [],
      productQuery: null,
      intent: extractIntentFromText(text),
      theme: extractThemeFromText(text),
      offer: extractOfferFromText(text),
      style: extractStyleTermsFromText(text),
      layout: extractLayoutEmphasis(text),
      flavor: "",
      scenario: extractScenarioFromText(text),
      characteristic: "",
      composition: "",
      isRevisionOnly: true,
      isBareSelection: false,
      needsProductClarification: false,
      needsAcervoLookup: false,
      substitution: null,
      operation: { type: "patch", product: "", suppressNoisyProduct: true },
      produto_referencia: null,
      source: "deterministic",
    };
  }
  const slashProducts = extractSlashProductCommands(text)
    .map((p) => refineProductQuery(p) || p)
    .filter(Boolean);
  const styles = extractStyleTermsFromText(text);
  const vagueProduct = isVagueProductReference(text);
  const substitution = detectProductSubstitution(text);
  const productHints = vagueProduct
    ? []
    : extractExplicitProductHints(text)
        .map((h) => refineProductQuery(h) || h)
        .filter(looksLikeProductCandidate);
  const fromStrip = refineProductQuery(stripCreationNoiseForProductSearch(text));
  const hint0 = productHints.find(
    (h) => looksLikeProductCandidate(h) && !/^(espaco|chamada|lancamento|vibe|elementos)$/i.test(h),
  );
  const productQuery =
    substitution?.to ||
    slashProducts.find(looksLikeProductCandidate) ||
    hint0 ||
    (!vagueProduct &&
    !hasStateMutationOperator(text) &&
    looksLikeProductCandidate(fromStrip)
      ? fromStrip
      : "") ||
    "";

  const cleanQuery = refineProductQuery(
    String(productQuery || "")
      .split(/\s+/)
      .filter((w) => !isVisualStyleTerm(w) && !isThemeNoiseTerm(w) && !PRODUCT_STOP_TOKENS.has(w))
      .join(" ")
      .trim(),
  );

  let revisionOnly = isCreationRevisionOnly(text);
  const intent = extractIntentFromText(text);
  const theme = extractThemeFromText(text);
  const offer = extractOfferFromText(text);
  const layout = extractLayoutEmphasis(text);
  const flavor = extractFlavorFromText(text);
  const scenario = extractScenarioFromText(text);
  const characteristic = extractCharacteristicFromText(text);
  const composition = extractCompositionFromText(text);

  // Estilo/cenário do próprio turno não pode virar productQuery.
  let safeQuery = cleanQuery;
  const nTurn = normalizeCreationText(text);
  if (safeQuery && scenario && normalizeCreationText(safeQuery) === normalizeCreationText(scenario)) {
    safeQuery = "";
  }
  if (safeQuery && styles.some((s) => normalizeCreationText(s) === normalizeCreationText(safeQuery))) {
    safeQuery = "";
  }
  // «mais + adjetivo» / «fundo de X» sem estrutura de mercadoria → só briefing.
  if (/^mais\s+[a-z]{3,}$/.test(nTurn) && !substitution?.to) {
    safeQuery = "";
    revisionOnly = true;
  }
  if (/^fundo\s+(de\s+|da\s+|do\s+)?[a-z]{3,}/.test(nTurn) && !substitution?.to) {
    safeQuery = "";
    revisionOnly = true;
  }
  if (!safeQuery && (styles.length || scenario || offer || theme || layout) && !substitution?.to) {
    revisionOnly = true;
  }

  const needsProductClarification = vagueProduct || (/\bproduto\b/i.test(text) && !safeQuery);

  const turn = {
    slashProducts,
    productHints,
    productQuery: safeQuery && looksLikeProductCandidate(safeQuery) ? safeQuery : null,
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
    needsProductClarification,
    needsAcervoLookup: Boolean(
      safeQuery &&
        looksLikeProductCandidate(safeQuery) &&
        !revisionOnly &&
        (slashProducts.length ||
          productHints.length ||
          substitution ||
          /\b(produto|tem|temos|promo|lancamento|campanha|monta|post)\b/i.test(text)),
    ),
    substitution,
  };
  turn.operation = classifyCreationOperation(text, turn, null);
  return turn;
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
 * @param {string} [rawText] texto original do turno (para detectar mutação)
 * @returns {CreationState}
 */
export function mergeCreationState(prev, turn, rawText = "") {
  const base = { ...emptyCreationState(), ...(prev || {}) };
  const next = { ...base };
  const op = classifyCreationOperation(rawText, turn, base);

  if (isCreationFlowMetaUtterance(rawText)) {
    // Fecha/aprova o fluxo: nunca sobrescreve produto acumulado.
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

  if (op.type === "replace_product" && op.product) {
    const cleaned = refineProductQuery(op.product) || op.product;
    if (cleaned && looksLikeProductCandidate(cleaned)) next.produto = cleaned;
  } else if (!op.suppressNoisyProduct) {
    const incoming =
      (turn.slashProducts || []).find(looksLikeProductCandidate) ||
      (turn.productHints || []).find(looksLikeProductCandidate) ||
      (!turn.isRevisionOnly && turn.productQuery && looksLikeProductCandidate(turn.productQuery)
        ? turn.productQuery
        : "");
    if (incoming) {
      const cleaned = refineProductQuery(incoming) || incoming;
      if (cleaned && looksLikeProductCandidate(cleaned)) next.produto = cleaned;
    }
  }

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
    if (isBriefingCorrectionNoise(t)) continue;
    state = mergeCreationState(state, parseCreationTurn(t), t);
  }
  if (currentQuestion && !isBriefingCorrectionNoise(currentQuestion)) {
    state = mergeCreationState(
      state,
      parseCreationTurn(currentQuestion),
      currentQuestion,
    );
  }
  return state;
}

/** Correção de painel — não altera produto/briefing. */
function isBriefingCorrectionNoise(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  return /^(n[aã]o\s+(est[aá]|t[aá])\s+corret|errado|n[aã]o\s+[eé]\s+isso|n[aã]o\s+era\s+isso|ta\s+errado|est[aá]\s+errado)/i.test(
    t,
  );
}

/**
 * Hint de briefing para resumo visual (intenção/estilo/preço).
 * NÃO usar como query de busca de produto/mídia — use productAcervoResolve.
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
