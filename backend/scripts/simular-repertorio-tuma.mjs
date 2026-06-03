/**
 * Simula conversas com o Tuma (pipeline Node + opcional LLM/HTTP).
 *
 * Uso:
 *   node backend/scripts/simular-repertorio-tuma.mjs
 *   node backend/scripts/simular-repertorio-tuma.mjs --llm          # inclui turnos LLM (lento)
 *   node backend/scripts/simular-repertorio-tuma.mjs --live URL JWT ID_EMPRESA
 *
 * Saída:
 *   docs/ia/repertorio-dialogo-gerado.json
 *   backend/ia/python/conversa/instrucoes/treino_repertorio_conversas.txt
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

const { analyzeChatTurn } = await import("../src/services/chatTurnIntent.js");
const { tryChatOutOfScopeResponse } = await import("../src/services/chatOutOfScopeResponse.js");
const { tryChatCompositeResponse } = await import("../src/services/chatCompositeResponse.js");
const { tryChatAcervoResponse } = await import("../src/services/chatAcervoResponse.js");
const { formatEmpresaInfoAnswer } = await import("../src/services/chatEmpresaResponse.js");
const { formatContextosListAnswer } = await import("../src/services/chatContextosResponse.js");
const { guardChatProductAnswer } = await import("../src/services/chatProductGuard.js");
const { sanitizeChatAnswer } = await import("../src/services/chatAnswerSanitizer.js");
const { buildChatTrainingPromptBlock } = await import("../src/services/chatPromptBundle.js");

const FORA_ESCOPO_PERGUNTAS = [
  "que dia é hoje",
  "qual a data de hoje",
  "que horas são",
  "quero o dia da semana mes e ano",
  "me diz a data",
  "hoje é que dia",
  "qual dia estamos",
  "data completa por favor",
  "que dia da semana é hoje",
  "conta uma piada",
  "qual a previsão do tempo",
  "receita de bolo",
  "quem ganhou o jogo",
  "notícia do dia",
  "quanto tá o dólar",
];

const BAD_PATTERNS = [
  { id: "data_inventada", re: /m[eê]s espec[ií]fico n[aã]o mencionado|dia [uú]til\b/i },
  { id: "marketing_pitch", re: /marketing\s+visual da/i },
  { id: "mudar_foco", re: /mudar\s+o\s+foco/i },
  { id: "meta_sessao", re: /empresa em sess[aã]o|consultei o rag|embeddings/i },
  { id: "suplementos_generico", re: /suplementos de muscula[cç]/i },
  { id: "menu_bot", re: /op[cç][aã]o\s*1/i },
  { id: "english", re: /\bAs an AI\b/i },
  { id: "re_saudacao", re: /^(oi|ol[aá])!.*como posso ajudar/i },
];

const MOCK_FACTS = {
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

const ID_EMPRESA = "11111111-1111-4111-8111-111111111111";

/** @type {string[]} */
function loadBateriaMensagens() {
  const csvPath = path.join(ROOT, "docs/ia/bateria-treino-dialogo-120.csv");
  if (!fs.existsSync(csvPath)) return [];
  const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).slice(1);
  const msgs = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(/^"?\d+"?,"([^"]*)"/) || line.match(/^(\d+),([^,]+),/);
    if (m) msgs.push(m[1].replace(/""/g, '"'));
  }
  return msgs;
}

const EXTRA_PERGUNTAS_2 = [
  "oq vc faz",
  "o que é vc",
  "vc faz oq",
  "me explica vc",
  "tuma quem é",
  "cadê minha arte",
  "gerou a imagem?",
  "formato stories",
  "feed ou stories",
  "texto na imagem",
  "coloca preço no post",
  "post promocional",
  "arte com duas fotos",
  "usa logo da empresa",
  "cores da marca",
  "tom da black friday",
  "campanha de verão",
  "produto em destaque monster",
  "combo whey e creatina",
  "tem desconto?",
  "quando abre a loja",
  "onde fica a fy",
  "telefone da loja",
  "me manda o insta",
  "link do instagram",
  "quantas fotos no acervo",
  "só imagens ou vídeo também",
  "apaga contexto",
  "adiciona contexto",
  "treina a ia",
  "vc aprende?",
  "memória da conversa",
  "esquece o que falei",
  "nova conversa",
  "resetar chat",
  "teste 123",
  "asdfgh",
  "???",
  "hmm não sei",
  "talvez um post",
  "pensando aqui",
  "deixa eu ver",
  "um momento",
  "continua",
  "e daí?",
  "e o resto?",
  "mais detalhes",
  "resumo",
  "tl;dr",
];

const EXTRA_PERGUNTAS = [
  "e aí",
  "blz",
  "show",
  "então?",
  "hm",
  "ok e agora?",
  "não entendi",
  "explica melhor",
  "tipo assim, vc lista o que tem?",
  "cadê os produtos",
  "tem coisa de whey?",
  "monster energy tá aí?",
  "quero saber da loja",
  "instagram da fy",
  "monta post do monster",
  "faz um stories do whey",
  "gera arte",
  "sim",
  "não",
  "pode ser",
  "isso mesmo",
  "qual a diferença entre vocês e o chatgpt",
  "vc é chatgpt?",
  "me fala uma piada",
  "que horas são",
  "o que significa LOL",
  "tuma significa o que mesmo?",
  "quem criou você?",
  "vc é robô?",
  "ajuda aí",
  "preciso de ajuda",
  "to perdido",
  "primeira vez aqui",
  "como cadastro produto",
  "onde subo foto",
  "quantos produtos cadastrados",
  "lista tudo",
  "tem creatina?",
  "tem zzz produto fake",
  "preço do whey",
  "vocês entregam?",
  "campanha black friday",
  "contexto black friday",
  "oi tudo bem?",
  "fala mano",
  "eae tuma",
  "hey",
  "bom dia equipe",
  "boa noite galera",
  "vlw flw",
  "obrigado pela lista",
  "não era isso",
  "errei foi mal",
  "só queria o nome",
  "para de listar produto",
  "já perguntei isso",
  "repetiu de novo",
  "oi quem é vc",
  "oi como funciona o painel",
  "qual nome e quais produtos",
  "fala de vc e lista produtos",
  "pra que serve e tem monster?",
  "como funciona e o que tem no acervo",
  ...EXTRA_PERGUNTAS_2,
];

const SESSOES_MULTI = [
  ["oi", "que dia é hoje"],
  ["que dia é hoje", "quero o dia da semana mes e ano"],
  ["oi", "para oq vc serve"],
  ["oi", "quais produtos temos?", "tem monster?"],
  ["bom dia", "qual seu nome", "valeu"],
  ["quais produtos temos?", "fala sobre a empresa"],
  ["qual seu nome", "não era isso só queria seu nome"],
  ["oi", "vc consegue me ajudar?", "como faço pra pedir um post"],
  ["tem whey?", "monta um post do whey chocolate"],
  ["quais contextos temos?", "o que é black friday?"],
];

/**
 * @param {string} answer
 * @param {string} question
 */
function auditAnswer(answer, question) {
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
 * @param {string} question
 * @param {Array<{ role: string, content: string }>} history
 * @param {{ useLlm?: boolean }} opts
 */
async function simulateTurn(question, history, opts = {}) {
  const { nomeFantasia, empresa, contextos, acervo } = MOCK_FACTS;
  const turn = analyzeChatTurn(question, history, { nomeFantasia });

  if (turn.identityAnswer) {
    return {
      route: "identity",
      answer: turn.identityAnswer,
      topics: turn.topics,
      source: "deterministic",
    };
  }

  if (turn.outOfScopeAnswer) {
    return {
      route: "out_of_scope",
      answer: turn.outOfScopeAnswer,
      topics: turn.topics,
      source: "deterministic",
    };
  }

  const oos = tryChatOutOfScopeResponse(question, MOCK_FACTS.nomeFantasia);
  if (oos) {
    return { route: "out_of_scope", answer: oos, topics: [], source: "deterministic" };
  }

  if (turn.route === "composite") {
    const answer = await tryChatCompositeResponse({
      question,
      facts: MOCK_FACTS,
    });
    if (answer) {
      return { route: "composite", answer, topics: turn.topics, source: "deterministic" };
    }
  }

  if (turn.route === "empresa") {
    return {
      route: "empresa",
      answer: formatEmpresaInfoAnswer(empresa),
      topics: turn.topics,
      source: "deterministic",
    };
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
    if (answer) {
      return { route: "acervo", answer, topics: turn.topics, source: "deterministic" };
    }
  }

  if (!opts.useLlm) {
    return {
      route: "llm_skipped",
      answer: "[LLM não executado — use --llm]",
      topics: turn.topics,
      source: "skipped",
    };
  }

  try {
    const { ensureChatWorkerReady, runChatSerialized } = await import("../src/services/chatPythonWorker.js");
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
 * @param {string} baseUrl
 * @param {string} token
 * @param {string} idEmpresa
 * @param {string} question
 * @param {Array<{ role: string, content: string }>} history
 */
async function liveHttpTurn(baseUrl, token, idEmpresa, question, history) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/ia/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, history, id_empresa: idEmpresa }),
    signal: AbortSignal.timeout(360_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { route: "http_error", answer: body.error || res.statusText, source: "live" };
  }
  return {
    route: body.chat_route || "live",
    answer: String(body.answer || ""),
    topics: body.chat_topics || [],
    source: "live",
  };
}

function buildTreinoTxt(entries) {
  const lines = [
    "[Repertório gerado — exemplos reais do pipeline Tuma]",
    `Gerado em: ${new Date().toISOString()}`,
    "Use como referência de tom; adapte {EMPRESA} ao cadastro ativo.",
    "",
  ];
  for (const e of entries) {
    if (!e.answer || e.answer.startsWith("[LLM") || e.route === "llm_skipped") continue;
    if (!e.ok && !(e.source === "deterministic")) continue;
    lines.push(`Usuário: ${e.question}`);
    lines.push(`Tuma: ${e.answer.replace(/\n/g, " ")}`);
    if (e.issues?.length) lines.push(`# revisar: ${e.issues.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      llm: { type: "boolean", default: false },
      "llm-limit": { type: "string", default: "0" },
      live: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const useLlm = values.llm;
  const llmLimit = Math.max(0, parseInt(values["llm-limit"], 10) || 0);
  let llmUsed = 0;
  const liveUrl = positionals[0];
  const liveToken = positionals[1];
  const liveEmpresa = positionals[2];
  const useLive = values.live || Boolean(liveUrl && liveToken && liveEmpresa);

  const perguntas = [
    ...new Set([...loadBateriaMensagens(), ...EXTRA_PERGUNTAS, ...FORA_ESCOPO_PERGUNTAS]),
  ];
  /** @type {Array<Record<string, unknown>>} */
  const entries = [];
  let id = 0;

  console.log(`Simulando ${perguntas.length} perguntas isoladas + ${SESSOES_MULTI.length} sessões...`);

  for (const question of perguntas) {
    id += 1;
    const wantLlm = useLlm && (llmLimit === 0 || llmUsed < llmLimit);
    let out;
    if (useLive) {
      out = await liveHttpTurn(liveUrl || "http://127.0.0.1:4000", liveToken, liveEmpresa, question, []);
    } else {
      out = await simulateTurn(question, [], { useLlm: wantLlm });
      if (wantLlm && out.source === "llm") llmUsed += 1;
    }
    const issues = auditAnswer(out.answer, question);
    entries.push({
      id,
      session: "single",
      question,
      history: [],
      ...out,
      issues,
      ok: issues.length === 0,
    });
    if (id % 25 === 0) console.log(`  ${id} turnos...`);
  }

  for (const session of SESSOES_MULTI) {
    /** @type {Array<{ role: string, content: string }>} */
    const history = [];
    for (const question of session) {
      id += 1;
      let out;
      if (useLive) {
        out = await liveHttpTurn(
          liveUrl || "http://127.0.0.1:4000",
          liveToken,
          liveEmpresa,
          question,
          history,
        );
      } else {
        out = await simulateTurn(question, history, { useLlm });
      }
      const issues = auditAnswer(out.answer, question);
      entries.push({
        id,
        session: session.join(" → "),
        question,
        history: [...history],
        ...out,
        issues,
        ok: issues.length === 0,
      });
      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: out.answer });
    }
  }

  const okCount = entries.filter((e) => e.ok).length;
  const byRoute = {};
  for (const e of entries) {
    byRoute[e.route] = (byRoute[e.route] || 0) + 1;
  }
  const issueCounts = {};
  for (const e of entries) {
    for (const i of e.issues || []) issueCounts[i] = (issueCounts[i] || 0) + 1;
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: useLive ? "live" : useLlm ? "pipeline+llm" : "pipeline",
    total: entries.length,
    ok: okCount,
    fail: entries.length - okCount,
    taxa_ok: `${((okCount / entries.length) * 100).toFixed(1)}%`,
    rotas: byRoute,
    problemas: issueCounts,
    entries,
  };

  const jsonOut = path.join(ROOT, "docs/ia/repertorio-dialogo-gerado.json");
  const txtOut = path.join(
    ROOT,
    "backend/ia/python/conversa/instrucoes/treino_repertorio_conversas.txt",
  );

  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(txtOut, buildTreinoTxt(entries), "utf8");

  console.log("\n--- Relatório ---");
  console.log(`Total: ${report.total} | OK: ${report.ok} | Problemas: ${report.fail} (${report.taxa_ok})`);
  console.log("Rotas:", byRoute);
  if (Object.keys(issueCounts).length) console.log("Problemas:", issueCounts);
  console.log(`\nJSON: ${jsonOut}`);
  console.log(`Treino: ${txtOut}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
