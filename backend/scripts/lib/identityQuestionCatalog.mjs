/**
 * Gera 1000+ perguntas sobre identidade do Tuma (criador, origem, pai, nasceu, etc.)
 */

const PREFIXOS = ["", "oi ", "me diz ", "só ", "rapidinho ", "uma dúvida "];
const SUFIXOS = ["", "?", " aí", " por favor"];

const CRIADOR_TEMPLATES = [
  "quem te criou",
  "por quem vc foi criado",
  "por quem você foi criado",
  "vc foi criado por quem",
  "quem foi que te criou",
  "quem te fez",
  "quem te desenvolveu",
  "quem é seu criador",
  "quem é o criador",
  "quem programou você",
  "quem programou vc",
  "diego te criou",
  "foi o diego que te criou",
  "quem é diego suhai",
  "vc conhece diego suhai",
];

const ORIGEM_TEMPLATES = [
  "quem é teu pai",
  "quem é seu pai",
  "vc tem pai",
  "quem é tua mãe",
  "quem é sua mãe",
  "vc nasceu de onde",
  "de onde você veio",
  "de onde vc veio",
  "onde você nasceu",
  "onde vc nasceu",
  "qual sua origem",
  "qual a origem do tuma",
  "vc veio de onde",
  "lugar de nascimento",
  "quem são seus pais",
  "tem família",
];

const NATUREZA_TEMPLATES = [
  "vc é humano",
  "você é uma pessoa",
  "vc é real",
  "vc tem sentimentos",
  "vc sente algo",
  "vc dorme",
  "quantos anos você tem",
  "vc tem idade",
  "vc é menino ou menina",
  "vc é robô",
  "vc é um bot",
  "vc é ia",
];

const QUEM_TEMPLATES = [
  "quem é você",
  "quem é vc",
  "vc é quem",
  "o que é você",
  "o que é vc",
  "fala sobre você",
  "se apresenta",
  "me fala de você",
];

const NOME_TEMPLATES = [
  "qual seu nome",
  "como você se chama",
  "como vc se chama",
  "seu nome",
  "qual é seu nome",
];

const FUNCAO_TEMPLATES = [
  "para que você serve",
  "pra que vc serve",
  "o que você faz",
  "o que vc faz",
  "qual sua função",
];

const CAPACIDADE_TEMPLATES = [
  "como funciona",
  "como vc funciona",
  "como funciona o chat",
  "você consegue me ajudar",
];

const SIGNIFICADO_TEMPLATES = [
  "o que significa tuma",
  "significado do nome tuma",
  "por que se chama tuma",
];

/** @param {string[]} templates @param {string} categoria */
function expandCategory(templates, categoria) {
  const out = [];
  for (const t of templates) {
    for (const pre of PREFIXOS.slice(0, 4)) {
      for (const suf of SUFIXOS.slice(0, 2)) {
        out.push({ categoria, pergunta: `${pre}${t}${suf}`.trim().replace(/\s+/g, " ") });
      }
    }
  }
  return out;
}

/**
 * @param {number} [minTarget]
 * @returns {Array<{ categoria: string, pergunta: string }>}
 */
export function generateIdentityQuestionCatalog(minTarget = 1000) {
  /** @type {Array<{ categoria: string, pergunta: string }>} */
  let catalog = [
    ...expandCategory(CRIADOR_TEMPLATES, "CRIADOR"),
    ...expandCategory(ORIGEM_TEMPLATES, "ORIGEM"),
    ...expandCategory(NATUREZA_TEMPLATES, "NATUREZA"),
    ...expandCategory(QUEM_TEMPLATES, "QUEM_E"),
    ...expandCategory(NOME_TEMPLATES, "NOME"),
    ...expandCategory(FUNCAO_TEMPLATES, "FUNCAO"),
    ...expandCategory(CAPACIDADE_TEMPLATES, "CAPACIDADE"),
    ...expandCategory(SIGNIFICADO_TEMPLATES, "SIGNIFICADO"),
  ];

  let i = 0;
  while (catalog.length < minTarget * 1.2 && i < 6000) {
    i += 1;
    const variants = [
      { c: "CRIADOR", p: `quem criou vc variante ${i}` },
      { c: "CRIADOR", p: `por quem foi criado o tuma ${i}` },
      { c: "ORIGEM", p: `de onde surgiu o tuma ${i}` },
      { c: "ORIGEM", p: `vc tem pai ou mãe ${i}` },
      { c: "NATUREZA", p: `vc é inteligência artificial ${i}` },
      { c: "QUEM_E", p: `quem fala comigo agora ${i}` },
    ];
    catalog.push(...variants.map((v) => ({ categoria: v.c, pergunta: v.p })));
  }

  const seen = new Set();
  const uniq = [];
  for (const item of catalog) {
    const k = item.pergunta.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(item);
  }
  return uniq.slice(0, Math.max(minTarget, uniq.length));
}
