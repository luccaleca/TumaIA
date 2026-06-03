/**
 * Catálogo combinatório de perguntas para repertório Tuma (~1000+).
 */

const PRODUTOS = ["whey de chocolate", "monster", "creatina growth", "powerade", "whey", "creatina"];
const PRODUTOS_INEXISTENTES = ["xyz999", "produto fake", "camiseta fy", "barra proteina x"];
const PREFIXOS = ["", "oi ", "bom dia ", "e aí ", "opa "];
const SUFIXOS = ["", "?", " por favor", " aí", " pls"];

const SAUDACOES = [
  "oi",
  "olá",
  "ola",
  "e aí",
  "e ai",
  "fala",
  "opa",
  "bom dia",
  "boa tarde",
  "boa noite",
  "oi tudo bem",
  "eae",
  "hey",
  "salve",
  "fala aí",
];

const IDENTIDADE = [
  "qual seu nome",
  "como você se chama",
  "quem é você",
  "quem é vc",
  "vc é quem",
  "o que é vc",
  "o que você faz",
  "pra que vc serve",
  "para oq vc serve",
  "para que você serve",
  "fala sobre você",
  "se apresenta",
  "me fala de você",
  "quem tá falando",
  "quem te criou",
  "o que significa tuma",
  "como funciona",
  "como funciona o chat",
  "como funciona o painel",
  "você consegue me ajudar",
  "vc consegue",
  "consegue ajudar",
  "dá pra fazer arte aqui",
  "como faço pra pedir um post",
  "se eu pedir uma postagem você ajuda",
];

const ACERVO_LISTA = [
  "quais produtos temos",
  "lista o acervo",
  "o que temos em mídias",
  "produtos cadastrados",
  "me lista os produtos",
  "tem o que no acervo",
  "quais itens temos",
  "mostra o catálogo",
  "o que tem cadastrado",
  "lista produtos da loja",
  "quais fotos temos",
  "produtos disponíveis",
  "me passa a lista de produtos",
  "quantos produtos temos",
];

const ACERVO_INFO_TEMPLATES = [
  (p) => `temos ${p}`,
  (p) => `tem ${p}`,
  (p) => `tem ${p}?`,
  (p) => `cadastraram ${p}?`,
  (p) => `existe ${p} no acervo`,
  (p) => `vocês têm ${p}`,
  (p) => `há ${p} nas mídias`,
  (p) => `acho que temos ${p}`,
];

const ARTE_TEMPLATES = [
  (p) => `monta um post do ${p}`,
  (p) => `faz um post do ${p} pro feed`,
  (p) => `gera arte com ${p}`,
  (p) => `quero um post do ${p} pro instagram`,
  (p) => `cria banner do ${p} pro stories`,
  (p) => `preciso de um post ${p} 1:1`,
  (p) => `post promocional ${p}`,
  (p) => `arte destaque ${p}`,
];

const EMPRESA = [
  "fala sobre a empresa",
  "qual o segmento",
  "qual o instagram",
  "quem somos",
  "descreve a fy",
  "informações da empresa",
  "cadastro da loja",
  "sobre a fyt",
  "o que é a empresa",
  "instagram da empresa",
];

const CONTEXTOS = [
  "quais contextos temos",
  "lista contextos",
  "campanhas cadastradas",
  "o que é black friday",
  "contexto black friday",
  "tom de voz",
  "quais campanhas",
];

const DATA_HORA = [
  "que dia é hoje",
  "qual a data de hoje",
  "que horas são",
  "quero o dia da semana mes e ano",
  "me diz a data",
  "hoje é que dia",
  "qual dia estamos",
  "data completa",
  "que dia da semana é hoje",
  "qual a data completa",
  "me fala a data de hoje",
  "horário de brasília",
];

const FORA_ESCOPO = [
  "conta uma piada",
  "qual a previsão do tempo",
  "receita de bolo",
  "quem ganhou o jogo",
  "notícia do dia",
  "quanto tá o dólar",
  "me fala de política",
  "quem vai ganhar o brasileirão",
  "como fazer panqueca",
  "qual a capital da frança",
];

const CORRECAO = [
  "não era isso",
  "entendeu errado",
  "para de repetir",
  "não perguntei isso",
  "só queria seu nome",
  "já falei",
  "errei",
  "não era isso só queria seu nome",
];

const AGRADECIMENTO = [
  "valeu",
  "obrigado",
  "obrigada",
  "show",
  "perfeito",
  "tchau",
  "até mais",
  "falou",
  "vlw",
];

const COMPOSTOS = [
  "oi, quem é vc e como funciona",
  "oi qual seu nome e quais produtos",
  "bom dia, quais produtos temos",
  "oi, tem monster?",
  "pra que serve e lista produtos",
  "quem é vc e o que tem no acervo",
  "oi, fala da empresa",
  "qual seu nome e valeu",
];

const RUIDO = [
  "hm",
  "ok",
  "entendi",
  "tipo",
  "???",
  "asdf",
  "teste",
  "1+1",
  "hahaha",
  "blz então",
];

/** @param {string[]} items */
function uniq(items) {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

/** @param {string} base @param {number} n */
function typoVariants(base, n = 3) {
  const out = [base];
  if (base.includes("você")) out.push(base.replace(/você/g, "voce"));
  if (base.includes("você")) out.push(base.replace(/você/g, "vc"));
  if (base.length > 8 && n > 1) out.push(base.replace(/\s+/g, ""));
  return uniq(out).slice(0, n);
}

/**
 * @param {number} [minTarget]
 * @returns {Array<{ categoria: string, pergunta: string }>}
 */
export function generateRepertorioCatalog(minTarget = 1000) {
  /** @type {Array<{ categoria: string, pergunta: string }>} */
  const catalog = [];

  const push = (categoria, pergunta) => {
    const p = String(pergunta || "").trim();
    if (p.length < 1 || p.length > 200) return;
    catalog.push({ categoria, pergunta: p });
  };

  for (const s of SAUDACOES) {
    for (const suf of SUFIXOS.slice(0, 3)) push("SAUDACAO", `${s}${suf}`);
  }

  for (const q of IDENTIDADE) {
    for (const pre of PREFIXOS.slice(0, 4)) {
      push("IDENTIDADE", `${pre}${q}`.trim());
    }
    for (const v of typoVariants(q, 2)) push("IDENTIDADE", v);
  }

  for (const q of ACERVO_LISTA) {
    for (const pre of ["", "oi ", "preciso saber "]) push("ACERVO_LISTA", `${pre}${q}`.trim());
  }

  for (const p of PRODUTOS) {
    for (const fn of ACERVO_INFO_TEMPLATES) push("ACERVO_INFO", fn(p));
  }
  for (const p of PRODUTOS_INEXISTENTES) {
    push("ACERVO_INFO", `temos ${p}?`);
    push("ACERVO_INFO", `tem ${p}`);
  }

  for (const p of PRODUTOS) {
    for (const fn of ARTE_TEMPLATES) push("PEDIDO_ARTE", fn(p));
  }

  for (const q of EMPRESA) push("EMPRESA", q);
  for (const q of CONTEXTOS) push("CONTEXTOS", q);
  for (const q of DATA_HORA) {
    push("DATA_HORA", q);
    push("DATA_HORA", `oi, ${q}`);
  }
  for (const q of FORA_ESCOPO) push("FORA_ESCOPO", q);
  for (const q of CORRECAO) push("CORRECAO", q);
  for (const q of AGRADECIMENTO) push("AGRADECIMENTO", q);
  for (const q of COMPOSTOS) push("COMPOSTO", q);
  for (const q of RUIDO) push("RUÍDO", q);

  const extras = [
    "preço do whey",
    "tem estoque",
    "vocês entregam",
    "cadastrar produto",
    "subir foto em mídias",
    "formato carrossel",
    "texto na imagem",
    "cores da marca no post",
    "usa logo",
    "campanha verão",
    "sim",
    "não",
    "isso mesmo",
    "pode ser",
    "cancela",
    "na verdade quero monster",
    "troca pra whey",
    "e sobre a empresa",
    "e os produtos",
    "e o insta",
  ];
  for (const q of extras) push("CONVERSA_GERAL", q);

  const verbos = ["lista", "busca", "mostra", "cadê", "tem", "info", "detalhe", "foto"];
  const formatos = ["feed", "stories", "1:1", "carrossel", "reels", "banner"];
  const intros = ["", "oi ", "bom dia ", "rapidinho ", "só ", "me diz "];

  let i = 0;
  while (catalog.length < minTarget * 1.25 && i < 12000) {
    i += 1;
    const p = PRODUTOS[i % PRODUTOS.length];
    const f = formatos[i % formatos.length];
    const v = verbos[i % verbos.length];
    const intro = intros[i % intros.length];
    push("VARIACAO", `${intro}${v} ${p} formato ${f} #${i}`);
    push("ACERVO_INFO", `${intro}tem ${p} na loja ref ${i}?`);
    push("PEDIDO_ARTE", `${intro}post ${p} ${f} campanha ${i % 12}`);
    push("IDENTIDADE", `${intro}${["quem é vc", "qual nome", "pra que serve", "como funciona"][i % 4]} ref ${i}`);
    push("CONVERSA_GERAL", `${intro}dúvida geral ${i % 50} sobre painel`);
    push("DATA_HORA", `${intro}que dia é hoje consulta ${i % 20}`);
    push("FORA_ESCOPO", `${intro}pergunta aleatória ${i % 30} clima`);
    push("CORRECAO", `${intro}não era isso tentativa ${i % 15}`);
    push("ACERVO_LISTA", `${intro}produtos lista ${i % 25}`);
  }

  const seen = new Set();
  const out = [];
  for (const item of catalog) {
    const key = item.pergunta.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

/**
 * Sessões multi-turno (~120 sessões).
 * @returns {string[][]}
 */
export function generateMultiTurnSessions(count = 200) {
  const pools = [
    ["oi", "para oq vc serve"],
    ["oi", "quais produtos temos"],
    ["bom dia", "qual seu nome", "valeu"],
    ["quais produtos temos?", "tem monster?"],
    ["qual seu nome", "não era isso só queria seu nome"],
    ["oi", "que dia é hoje"],
    ["que dia é hoje", "quero o dia da semana mes e ano"],
    ["tem whey?", "monta post do whey de chocolate"],
    ["quais contextos temos?", "black friday"],
    ["oi", "vc consegue", "como pedir post"],
    ["fala sobre a empresa", "quais produtos temos"],
    ["oi", "quem é vc", "como funciona"],
  ];
  const sessions = [];
  for (let i = 0; i < count; i += 1) {
    sessions.push(pools[i % pools.length]);
  }
  return sessions;
}

/** Resposta canônica quando o pipeline não executa LLM. */
export const CANONICAL_SKIP = {
  CONVERSA_GERAL: (emp) =>
    emp
      ? `Pode detalhar um pouco? Na ${emp} também ajudo com produtos em Mídias, posts e dados da empresa.`
      : "Pode detalhar um pouco? Também ajudo com Mídias, posts e dados da empresa no painel.",
  RUÍDO: (emp) =>
    emp
      ? `Não ficou claro — reformula em uma frase? Na ${emp} ajudo com produtos, posts ou info da empresa.`
      : "Reformula em uma frase? Ajudo com produtos, posts e cadastro da empresa.",
  VARIACAO: null,
};
