/**
 * Motor de simulação do pipeline de chat (reutilizado pelos geradores de repertório).
 */

export const MOCK_FACTS = {
  nomeFantasia: "FYT",
  empresa: {
    nome_fantasia: "FYT",
    segmento: "Suplementos e fitness",
    descricao: "Loja de suplementos com foco em performance.",
    instagram: "@fytoficial",
  },
  contextos: [
    { nome: "Black Friday", descricao: "Promoções de novembro e dezembro." },
    { nome: "Tom de voz", descricao: "Direto, motivacional, sem exageros." },
  ],
  acervo: {
    nomeFantasia: "FYT",
    labels: ["whey de chocolate", "monster", "creatina growth", "powerade"],
    midias: [
      { tipo_midia: "imagem", nome_exibicao: "whey de chocolate", nome_arquivo: "whey-chocolate.png" },
      { tipo_midia: "imagem", nome_exibicao: "monster", nome_arquivo: "monster.png" },
      { tipo_midia: "imagem", nome_exibicao: "creatina growth", nome_arquivo: "creatina-growth.png" },
      { tipo_midia: "imagem", nome_exibicao: "powerade", nome_arquivo: "powerade.png" },
    ],
  },
};

export const ID_EMPRESA = "11111111-1111-4111-8111-111111111111";

export const BAD_PATTERNS = [
  { id: "data_inventada", re: /m[eê]s espec[ií]fico n[aã]o mencionado|dia [uú]til\b/i },
  { id: "marketing_pitch", re: /marketing\s+visual da/i },
  { id: "mudar_foco", re: /mudar\s+o\s+foco/i },
  { id: "meta_sessao", re: /empresa em sess[aã]o|consultei o rag|embeddings/i },
  { id: "suplementos_generico", re: /suplementos de muscula[cç]/i },
  { id: "menu_bot", re: /op[cç][aã]o\s*1/i },
  { id: "english", re: /\bAs an AI\b/i },
];

const {
  analyzeChatTurn,
} = await import("../../src/services/chatTurnIntent.js");
const { tryChatOutOfScopeResponse } = await import("../../src/services/chatOutOfScopeResponse.js");
const { tryChatCompositeResponse } = await import("../../src/services/chatCompositeResponse.js");
const { tryChatAcervoResponse } = await import("../../src/services/chatAcervoResponse.js");
const { formatEmpresaInfoAnswer } = await import("../../src/services/chatEmpresaResponse.js");
const { formatContextosListAnswer } = await import("../../src/services/chatContextosResponse.js");
const { guardChatProductAnswer } = await import("../../src/services/chatProductGuard.js");
const { sanitizeChatAnswer } = await import("../../src/services/chatAnswerSanitizer.js");
const { buildChatTrainingPromptBlock } = await import("../../src/services/chatPromptBundle.js");
const { CANONICAL_SKIP } = await import("./repertorioCatalog.mjs");
const { tryChatConversaNaturalResponse } = await import("../../src/services/chatConversaNatural.js");

/**
 * @param {string} answer
 * @param {string} question
 */
export function auditAnswer(answer, question) {
  const issues = [];
  for (const p of BAD_PATTERNS) {
    if (p.re.test(answer)) issues.push(p.id);
  }
  if (/\bqual seu nome\b/i.test(question) && /\bwhey|monster|produtos?:/i.test(answer)) {
    issues.push("identidade_com_produtos");
  }
  const qGreeting =
    /^\s*(oi|ol[aá]|e\s*a[ií]|fala|opa|bom\s+dia|boa\s+tarde|boa\s+noite)/i.test(question);
  if (/^oi!?\s/i.test(answer) && !qGreeting) {
    issues.push("saudacao_nao_pedida");
  }
  return issues;
}

/**
 * @param {string} categoria
 * @param {string | null} nomeFantasia
 */
function canonicalForSkip(categoria, nomeFantasia) {
  const emp = nomeFantasia || "FYT";
  const fn = CANONICAL_SKIP[categoria];
  if (typeof fn === "function") return fn(emp);
  if (categoria === "VARIACAO") {
    return `Sobre isso, na ${emp} o que importa é o que está em Mídias — quer listar produtos ou montar post?`;
  }
  return `Na ${emp} posso ajudar com Mídias, posts e informações cadastradas — o que você precisa?`;
}

/**
 * @param {string} question
 * @param {Array<{ role: string, content: string }>} history
 * @param {{ useLlm?: boolean, categoria?: string }} opts
 */
export async function simulateTurn(question, history, opts = {}) {
  const { nomeFantasia, empresa, contextos, acervo } = MOCK_FACTS;
  const turn = analyzeChatTurn(question, history, { nomeFantasia });

  if (turn.identityAnswer) {
    return { route: "identity", answer: turn.identityAnswer, topics: turn.topics, source: "deterministic" };
  }
  if (turn.outOfScopeAnswer) {
    return { route: "out_of_scope", answer: turn.outOfScopeAnswer, topics: turn.topics, source: "deterministic" };
  }
  const oos = tryChatOutOfScopeResponse(question, nomeFantasia);
  if (oos) return { route: "out_of_scope", answer: oos, topics: [], source: "deterministic" };

  if (turn.route === "composite") {
    const answer = await tryChatCompositeResponse({ question, facts: MOCK_FACTS });
    if (answer) return { route: "composite", answer, topics: turn.topics, source: "deterministic" };
  }
  if (turn.route === "empresa") {
    return { route: "empresa", answer: formatEmpresaInfoAnswer(empresa), topics: turn.topics, source: "deterministic" };
  }
  if (turn.route === "contextos") {
    return {
      route: "contextos",
      answer: formatContextosListAnswer(contextos),
      topics: turn.topics,
      source: "deterministic",
    };
  }
  if (turn.route === "acervo" && turn.acervo) {
    const answer = await tryChatAcervoResponse({
      question,
      history,
      idEmpresa: ID_EMPRESA,
      db: null,
      midias: acervo.midias,
      nomeFantasia: acervo.nomeFantasia,
      classifyIntent: () => turn.acervo,
    });
    if (answer) return { route: "acervo", answer, topics: turn.topics, source: "deterministic" };
  }

  const natural = tryChatConversaNaturalResponse(question, nomeFantasia);
  if (natural) {
    return { route: "conversa_natural", answer: natural, topics: turn.topics, source: "deterministic" };
  }

  if (!opts.useLlm) {
    const cat = opts.categoria || "CONVERSA_GERAL";
    return {
      route: "canonical",
      answer: canonicalForSkip(cat, nomeFantasia),
      topics: turn.topics,
      source: "canonical",
    };
  }

  try {
    const { ensureChatWorkerReady, runChatSerialized } = await import("../../src/services/chatPythonWorker.js");
    await ensureChatWorkerReady();
    const trainingBlock = turn.includeAcervoInPrompt
      ? buildChatTrainingPromptBlock({
          empresa,
          contextos,
          acervoLabels: acervo.labels,
          nomeFantasia,
        })
      : "";
    const result = await runChatSerialized({
      question,
      history,
      id_empresa: ID_EMPRESA,
      ...(trainingBlock ? { acervo_context: trainingBlock } : {}),
      ...(turn.chat_mode ? { chat_mode: turn.chat_mode } : {}),
    });
    if (!result?.ok) {
      return { route: "llm_error", answer: result?.error || "erro", topics: turn.topics, source: "llm" };
    }
    let answer = String(result.result || "");
    if (turn.needsProductGuard) {
      answer = guardChatProductAnswer(answer, acervo.midias, nomeFantasia, { userQuestion: question });
    }
    answer = sanitizeChatAnswer({ answer, question, history, nomeFantasia });
    return { route: turn.route || "llm_rag", answer, topics: turn.topics, source: "llm" };
  } catch (err) {
    return {
      route: "llm_error",
      answer: err instanceof Error ? err.message : String(err),
      topics: turn.topics,
      source: "llm",
    };
  }
}

/**
 * @param {Array<Record<string, unknown>>} entries
 * @param {number} maxPairs
 */
export function buildStratifiedSample(entries, maxPairs = 150) {
  const usable = entries.filter(
    (e) => e.answer && !String(e.answer).startsWith("[LLM") && e.ok !== false,
  );
  const byCat = new Map();
  for (const e of usable) {
    const c = e.categoria || "OUTROS";
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push(e);
  }
  const perCat = Math.max(3, Math.floor(maxPairs / byCat.size));
  const picked = [];
  const seen = new Set();
  for (const [, list] of byCat) {
    let n = 0;
    for (const e of list) {
      if (n >= perCat) break;
      const k = e.question;
      if (seen.has(k)) continue;
      seen.add(k);
      picked.push(e);
      n += 1;
    }
  }
  let i = 0;
  while (picked.length < maxPairs && i < usable.length) {
    const e = usable[i++];
    if (seen.has(e.question)) continue;
    seen.add(e.question);
    picked.push(e);
  }
  return picked;
}

/**
 * @param {Array<Record<string, unknown>>} entries
 * @param {{ title?: string }} [opts]
 */
export function buildTreinoTxt(entries, opts = {}) {
  const lines = [
    opts.title || "[Repertório Tuma IA — exemplos contextualizados]",
    `Gerado em: ${new Date().toISOString()}`,
    "Adapte {EMPRESA} ao cadastro ativo. Não copie FYT se a empresa for outra.",
    "",
  ];
  for (const e of entries) {
    if (!e.answer || String(e.answer).startsWith("[LLM")) continue;
    lines.push(`# ${e.categoria || "GERAL"} | rota: ${e.route || "?"}`);
    lines.push(`Usuário: ${e.question}`);
    lines.push(`Tuma: ${String(e.answer).replace(/\n/g, " ")}`);
    if (e.issues?.length) lines.push(`# revisar: ${e.issues.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}
