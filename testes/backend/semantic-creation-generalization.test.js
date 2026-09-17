/**
 * Etapa 2 — generalização semântica (SEM gerar imagem, SEM novas regras de produção).
 *
 * Frases diferentes da bateria original; mesmas intenções.
 * Falhas são reportadas; o interpretador NÃO é ajustado neste arquivo.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  parseCreationTurn,
  mergeCreationState,
  emptyCreationState,
  deriveCreationStateFromHistory,
} from "../../backend/src/services/chatCreationInterpret.js";
import {
  normalizeArteBrief,
  buildArteBriefFromHistory,
} from "../../backend/src/services/rawImageArteBrief.js";
import {
  formatoToJson,
  getFormatPresetById,
  tryDetectFormatPresetFromText,
} from "../../backend/src/services/arteFormatPresets.js";

/**
 * @typedef {{
 *   produto?: RegExp | null,
 *   cenario?: string | RegExp | null,
 *   oferta?: RegExp | null,
 *   estilo?: RegExp | null,
 *   destaque?: RegExp | null,
 *   tema?: RegExp | null,
 *   intencao?: string | RegExp | null,
 *   needsProductClarification?: boolean,
 *   formato?: string | RegExp,
 *   noProduto?: RegExp,
 *   noCenarioNoise?: RegExp,
 * }} Expect
 */

/** @type {{ id: string, frase: string, ok: boolean, campo?: string, esperado?: string, recebido?: string }[]} */
const RESULTS = [];

/**
 * @param {ReturnType<typeof parseCreationTurn> | ReturnType<typeof emptyCreationState>} got
 */
function snap(got) {
  if (got && typeof got === "object" && ("productQuery" in got || "intent" in got)) {
    const t = /** @type {ReturnType<typeof parseCreationTurn>} */ (got);
    return {
      produto: t.productQuery || "",
      intencao: t.intent || "",
      cenario: t.scenario || "",
      tema: t.theme || "",
      oferta: t.offer || "",
      estilo: Array.isArray(t.style) ? t.style.join(", ") : "",
      destaque: t.layout || "",
      needsProductClarification: Boolean(t.needsProductClarification),
    };
  }
  const s = /** @type {ReturnType<typeof emptyCreationState>} */ (got);
  return {
    produto: s.produto || "",
    intencao: s.intencao || "",
    cenario: s.cenario || "",
    tema: s.tema || "",
    oferta: s.oferta || "",
    estilo: s.estilo || "",
    destaque: s.destaque || "",
    needsProductClarification: false,
  };
}

/**
 * @param {string} id
 * @param {string} frase
 * @param {Expect} expect
 * @param {() => Record<string, unknown>} getActual
 */
function genCase(id, frase, expect, getActual) {
  it(`${id}`, () => {
    try {
      const actual = getActual();
      const fields = /** @type {Array<keyof Expect>} */ ([
        "produto",
        "cenario",
        "oferta",
        "estilo",
        "destaque",
        "tema",
        "intencao",
        "needsProductClarification",
        "formato",
      ]);

      for (const field of fields) {
        if (!(field in expect) || expect[field] === undefined) continue;
        const exp = expect[field];
        const got = actual[field];

        if (field === "needsProductClarification") {
          if (Boolean(got) !== Boolean(exp)) {
            RESULTS.push({
              id,
              frase,
              ok: false,
              campo: field,
              esperado: String(exp),
              recebido: String(got),
            });
            assert.fail(
              `[${field}] esperado=${exp} recebido=${got} | frase=${JSON.stringify(frase)}`,
            );
          }
          continue;
        }

        if (exp === null) {
          if (got) {
            RESULTS.push({
              id,
              frase,
              ok: false,
              campo: field,
              esperado: "(vazio)",
              recebido: String(got),
            });
            assert.fail(`[${field}] deveria estar vazio; recebido=${got}`);
          }
          continue;
        }

        if (exp instanceof RegExp) {
          if (!exp.test(String(got || ""))) {
            RESULTS.push({
              id,
              frase,
              ok: false,
              campo: field,
              esperado: String(exp),
              recebido: String(got ?? ""),
            });
            assert.fail(
              `[${field}] esperado~${exp} recebido=${JSON.stringify(got)} | frase=${JSON.stringify(frase)}`,
            );
          }
          continue;
        }

        if (typeof exp === "string") {
          if (String(got || "") !== exp) {
            RESULTS.push({
              id,
              frase,
              ok: false,
              campo: field,
              esperado: exp,
              recebido: String(got ?? ""),
            });
            assert.fail(
              `[${field}] esperado=${exp} recebido=${got} | frase=${JSON.stringify(frase)}`,
            );
          }
        }
      }

      if (expect.noProduto instanceof RegExp) {
        if (expect.noProduto.test(String(actual.produto || ""))) {
          RESULTS.push({
            id,
            frase,
            ok: false,
            campo: "produto",
            esperado: `não conter ${expect.noProduto}`,
            recebido: String(actual.produto || ""),
          });
          assert.fail(`produto não deveria casar ${expect.noProduto}`);
        }
      }
      if (expect.noCenarioNoise instanceof RegExp) {
        if (expect.noCenarioNoise.test(String(actual.cenario || ""))) {
          RESULTS.push({
            id,
            frase,
            ok: false,
            campo: "cenario",
            esperado: `não conter ${expect.noCenarioNoise}`,
            recebido: String(actual.cenario || ""),
          });
          assert.fail(`cenário não deveria casar ${expect.noCenarioNoise}`);
        }
      }

      RESULTS.push({ id, frase, ok: true });
    } catch (err) {
      if (!RESULTS.some((r) => r.id === id && !r.ok)) {
        RESULTS.push({
          id,
          frase,
          ok: false,
          campo: "execucao",
          esperado: "passar",
          recebido: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }
  });
}

describe("generalização semântica — etapa 2 (sem imagem, sem novas regras)", () => {
  // ——— Preço / oferta (vocabulário e ordem diferentes da bateria 1) ———
  genCase(
    "G01",
    "Esse whey sai por 79,90 nessa peça.",
    { produto: /whey/i, oferta: /79/ },
    () => snap(parseCreationTurn("Esse whey sai por 79,90 nessa peça.")),
  );
  genCase(
    "G02",
    "Dá pra colocar 79,90 na arte do whey?",
    { produto: /whey/i, oferta: /79/ },
    () => snap(parseCreationTurn("Dá pra colocar 79,90 na arte do whey?")),
  );
  genCase(
    "G03",
    "A promoção fica em 79,90 — do whey.",
    { produto: /whey/i, oferta: /79/, intencao: /promocao/i },
    () => snap(parseCreationTurn("A promoção fica em 79,90 — do whey.")),
  );
  genCase(
    "G04",
    "Inclui o valor: 79,90.",
    { oferta: /79/ },
    () => snap(parseCreationTurn("Inclui o valor: 79,90.")),
  );
  genCase(
    "G05",
    "Quanto custa na arte? 79,90.",
    { oferta: /79/ },
    () => snap(parseCreationTurn("Quanto custa na arte? 79,90.")),
  );
  genCase(
    "G06",
    "Bota o whey a 79,90.",
    { produto: /whey/i, oferta: /79/ },
    () => snap(parseCreationTurn("Bota o whey a 79,90.")),
  );
  genCase(
    "G07",
    "79,90 é o preço do whey nessa arte.",
    { produto: /whey/i, oferta: /79/, noCenarioNoise: /79|preco/i },
    () => snap(parseCreationTurn("79,90 é o preço do whey nessa arte.")),
  );

  // ——— Cenário ———
  genCase(
    "G08",
    "Monta o whey num ambiente de academia.",
    { produto: /whey/i, cenario: "academia" },
    () => snap(parseCreationTurn("Monta o whey num ambiente de academia.")),
  );
  genCase(
    "G09",
    "Preciso do whey com background de academia.",
    { produto: /whey/i, cenario: "academia" },
    () => snap(parseCreationTurn("Preciso do whey com background de academia.")),
  );
  genCase(
    "G10",
    "Cenário: academia. Produto: whey.",
    { produto: /whey/i, cenario: "academia" },
    () => snap(parseCreationTurn("Cenário: academia. Produto: whey.")),
  );
  genCase(
    "G11",
    "Como se o whey estivesse no meio do treino.",
    { produto: /whey/i, cenario: /academia|treino|fitness/i },
    () => snap(parseCreationTurn("Como se o whey estivesse no meio do treino.")),
  );
  genCase(
    "G12",
    "Leva o whey pra praia nessa arte.",
    { produto: /whey/i, cenario: "praia" },
    () => snap(parseCreationTurn("Leva o whey pra praia nessa arte.")),
  );

  // ——— Estilo ———
  genCase(
    "G13",
    "Quero cara de foto de verdade.",
    { estilo: /photorealistic|realista|fotografia/i, produto: null },
    () => snap(parseCreationTurn("Quero cara de foto de verdade.")),
  );
  genCase(
    "G14",
    "Visual de revista, bem editorial.",
    { estilo: /editorial/i },
    () => snap(parseCreationTurn("Visual de revista, bem editorial.")),
  );
  genCase(
    "G15",
    "Deixa com cara mais sofisticada.",
    { estilo: /sofisticad|premium|elegante/i },
    () => snap(parseCreationTurn("Deixa com cara mais sofisticada.")),
  );
  genCase(
    "G16",
    "Algo bem clean, sem poluição visual.",
    { estilo: /clean|minimal|limpo/i },
    () => snap(parseCreationTurn("Algo bem clean, sem poluição visual.")),
  );
  genCase(
    "G17",
    "Pode ser cinematográfico.",
    { estilo: /cinematic|cinematograf/i },
    () => snap(parseCreationTurn("Pode ser cinematográfico.")),
  );
  genCase(
    "G18",
    "Sobe a saturação — mais vivo, mais vibrante.",
    { estilo: /vibrante/i },
    () => snap(parseCreationTurn("Sobe a saturação — mais vivo, mais vibrante.")),
  );

  // ——— Destaque ———
  genCase(
    "G19",
    "O 79,90 precisa pular na cara do cliente.",
    { oferta: /79/, destaque: /pre[cç]o|destaque|aten/i },
    () => snap(parseCreationTurn("O 79,90 precisa pular na cara do cliente.")),
  );
  genCase(
    "G20",
    "Evidencia bastante o valor de 79,90.",
    { oferta: /79/, destaque: /pre[cç]o|destaque/i },
    () => snap(parseCreationTurn("Evidencia bastante o valor de 79,90.")),
  );
  genCase(
    "G21",
    "Deixa a oferta gritando na arte — 79,90.",
    { oferta: /79/, destaque: /pre[cç]o|destaque|aten|oferta/i },
    () => snap(parseCreationTurn("Deixa a oferta gritando na arte — 79,90.")),
  );

  // ——— Produto (formas indiretas / ordem) ———
  genCase(
    "G22",
    "A arte é do whey, ok?",
    { produto: /whey/i },
    () => snap(parseCreationTurn("A arte é do whey, ok?")),
  );
  genCase(
    "G23",
    "Usa o whey como protagonista.",
    { produto: /whey/i },
    () => snap(parseCreationTurn("Usa o whey como protagonista.")),
  );
  genCase(
    "G24",
    "Trabalha em cima da creatina.",
    { produto: /creatina/i },
    () => snap(parseCreationTurn("Trabalha em cima da creatina.")),
  );

  // ——— Frases compostas (ordem / coloquial) ———
  genCase(
    "G25",
    "Academia no fundo, whey na frente, 79,90 bem aparente, visual moderno.",
    {
      produto: /whey/i,
      cenario: "academia",
      oferta: /79/,
      destaque: /pre[cç]o|destaque/i,
      estilo: /moderno/i,
      noCenarioNoise: /79|preco/i,
    },
    () =>
      snap(
        parseCreationTurn(
          "Academia no fundo, whey na frente, 79,90 bem aparente, visual moderno.",
        ),
      ),
  );
  genCase(
    "G26",
    "Me faz um post: whey + gym + preço 79,90 chamativo e premium.",
    {
      produto: /whey/i,
      cenario: /academia/i,
      oferta: /79/,
      destaque: /pre[cç]o|destaque|aten/i,
      estilo: /premium/i,
    },
    () =>
      snap(
        parseCreationTurn(
          "Me faz um post: whey + gym + preço 79,90 chamativo e premium.",
        ),
      ),
  );
  genCase(
    "G27",
    "Indireto: se der, rola uma peça do whey na academia com aquele 79,90 em evidência.",
    {
      produto: /whey/i,
      cenario: "academia",
      oferta: /79/,
      destaque: /pre[cç]o|destaque/i,
    },
    () =>
      snap(
        parseCreationTurn(
          "Indireto: se der, rola uma peça do whey na academia com aquele 79,90 em evidência.",
        ),
      ),
  );

  // ——— Troca / alteração de preço ———
  genCase(
    "G28",
    "Troca o valor pro 69,90.",
    { oferta: /69/ },
    () => {
      let state = deriveCreationStateFromHistory([
        { role: "user", content: "Quero esse whey na academia por R$ 79,90." },
      ]);
      state = mergeCreationState(state, parseCreationTurn("Troca o valor pro 69,90."));
      return snap(state);
    },
  );
  genCase(
    "G29",
    "Na verdade o preço certo é 69,90.",
    { oferta: /69/, produto: /whey/i, cenario: "academia" },
    () => {
      let state = deriveCreationStateFromHistory([
        { role: "user", content: "Quero esse whey na academia por R$ 79,90." },
      ]);
      state = mergeCreationState(state, parseCreationTurn("Na verdade o preço certo é 69,90."));
      return snap(state);
    },
  );

  // ——— Alteração de cenário ———
  genCase(
    "G30",
    "Esquece academia — põe praia.",
    { cenario: "praia", produto: /whey/i, oferta: /79/ },
    () => {
      let state = deriveCreationStateFromHistory([
        { role: "user", content: "Quero esse whey na academia por R$ 79,90." },
      ]);
      state = mergeCreationState(state, parseCreationTurn("Esquece academia — põe praia."));
      return snap(state);
    },
  );
  genCase(
    "G31",
    "Muda o ambiente pra praia.",
    { cenario: "praia", produto: /whey/i },
    () => {
      let state = deriveCreationStateFromHistory([
        { role: "user", content: "Quero esse whey na academia por R$ 79,90." },
      ]);
      state = mergeCreationState(state, parseCreationTurn("Muda o ambiente pra praia."));
      return snap(state);
    },
  );

  // ——— Alteração de formato ———
  genCase(
    "G32",
    "Versão stories, por favor.",
    { formato: "9:16" },
    () => {
      const preset = tryDetectFormatPresetFromText("Versão stories, por favor.");
      return { formato: preset?.ratio || "" };
    },
  );
  genCase(
    "G33",
    "Quero no formato de reel.",
    { formato: "9:16" },
    () => {
      const preset = tryDetectFormatPresetFromText("Quero no formato de reel.");
      return { formato: preset?.ratio || "" };
    },
  );
  genCase(
    "G34",
    "Mantém o briefing, só muda pra 4:5.",
    { oferta: /79/, produto: /whey/i, formato: "4:5" },
    () => {
      const ui = normalizeArteBrief({
        formato: formatoToJson(getFormatPresetById("post_square")),
        texto: "R$79,90",
        tema: "whey academia",
      });
      const preset = tryDetectFormatPresetFromText("Mantém o briefing, só muda pra 4:5.");
      const next = normalizeArteBrief({
        ...ui,
        formato: formatoToJson(preset || getFormatPresetById("post_square")),
      });
      const state = deriveCreationStateFromHistory([
        { role: "user", content: "Quero esse whey na academia por R$ 79,90." },
      ]);
      return { ...snap(state), formato: next.formato.ratio, texto: next.texto };
    },
  );

  // ——— Contexto entre mensagens (vocabulário novo) ———
  genCase(
    "G35",
    "multi: peça do whey no gym → inclui 79,90 → destaca → mais luxo",
    {
      produto: /whey/i,
      cenario: "academia",
      oferta: /79/,
      destaque: /pre[cç]o|destaque/i,
      estilo: /premium|luxo|luxury/i,
    },
    () => {
      let state = emptyCreationState();
      state = mergeCreationState(
        state,
        parseCreationTurn("Me faz uma peça do whey no gym."),
      );
      state = mergeCreationState(state, parseCreationTurn("Inclui 79,90."));
      state = mergeCreationState(
        state,
        parseCreationTurn("Esse valor tem que chamar atenção."),
      );
      state = mergeCreationState(state, parseCreationTurn("Agora sobe o luxo."));
      return snap(state);
    },
  );

  // ——— Troca de produto (forma diferente) ———
  genCase(
    "G36",
    "Em vez do whey, usa creatina.",
    { produto: /creatina/i, noProduto: /whey/i, cenario: "academia", oferta: /79/ },
    () => {
      let state = deriveCreationStateFromHistory([
        { role: "user", content: "Quero uma arte do whey na academia por R$ 79,90." },
      ]);
      state = mergeCreationState(state, parseCreationTurn("Em vez do whey, usa creatina."));
      return snap(state);
    },
  );
  genCase(
    "G37",
    "Substitui pelo da creatina.",
    { produto: /creatina/i, noProduto: /whey/i },
    () => {
      let state = deriveCreationStateFromHistory([
        { role: "user", content: "Quero uma arte do whey na academia por R$ 79,90." },
      ]);
      state = mergeCreationState(state, parseCreationTurn("Substitui pelo da creatina."));
      return snap(state);
    },
  );

  // ——— Perguntas realmente necessárias ———
  genCase(
    "G38",
    "Faz uma arte daquele item novo que a gente falou.",
    { needsProductClarification: true, produto: null },
    () => snap(parseCreationTurn("Faz uma arte daquele item novo que a gente falou.")),
  );
  genCase(
    "G39",
    "Usa o produto que eu mencionei ontem.",
    { needsProductClarification: true, produto: null },
    () => snap(parseCreationTurn("Usa o produto que eu mencionei ontem.")),
  );
  genCase(
    "G40",
    "Quero arte daquela coisa lá.",
    { needsProductClarification: true, produto: null },
    () => snap(parseCreationTurn("Quero arte daquela coisa lá.")),
  );

  // ——— Ambíguos preço × cenário (frase nova) ———
  genCase(
    "G41",
    "No gym, com o 79,90 bem claro na peça.",
    {
      cenario: /academia/i,
      oferta: /79/,
      destaque: /pre[cç]o|destaque/i,
      noCenarioNoise: /79|preco/i,
    },
    () => snap(parseCreationTurn("No gym, com o 79,90 bem claro na peça.")),
  );
  genCase(
    "G42",
    "Fundo academia; comercial: 79,90.",
    { cenario: "academia", oferta: /79/, noCenarioNoise: /79|comercial/i },
    () => snap(parseCreationTurn("Fundo academia; comercial: 79,90.")),
  );

  // ——— Preservação com frase nova de estilo ———
  genCase(
    "G43",
    "Agora só o clima: mais editorial.",
    {
      produto: /whey/i,
      cenario: "academia",
      oferta: /79/,
      estilo: /editorial/i,
    },
    () => {
      let state = emptyCreationState();
      state.produto = "whey";
      state.cenario = "academia";
      state.oferta = "R$79,90";
      state.estilo = "premium";
      state = mergeCreationState(
        state,
        parseCreationTurn("Agora só o clima: mais editorial."),
      );
      return snap(state);
    },
  );

  // ——— Payload hipotético (frase nova) ———
  genCase(
    "G44",
    "Post do whey no treino, 79,90 em evidência, moderno.",
    { produto: /whey/i, cenario: /academia|treino/i, oferta: /79/ },
    () => {
      const q = "Post do whey no treino, 79,90 em evidência, moderno.";
      const state = deriveCreationStateFromHistory([{ role: "user", content: q }]);
      const brief = buildArteBriefFromHistory([{ role: "user", content: q }], [], {
        formato: formatoToJson(getFormatPresetById("feed_portrait")),
      });
      assert.equal(brief.formato.ratio, "4:5");
      assert.match(brief.texto || brief.tema, /79/);
      return snap(state);
    },
  );

  after(() => {
    const passed = RESULTS.filter((r) => r.ok).length;
    const failed = RESULTS.filter((r) => !r.ok);
    console.log("\n========== RESUMO GENERALIZAÇÃO (etapa 2) ==========");
    console.log(`Total de testes: ${RESULTS.length}`);
    console.log(`Passaram: ${passed}`);
    console.log(`Falharam: ${failed.length}`);
    if (failed.length) {
      console.log("\nFalhas (sem correção automática):");
      for (const f of failed) {
        console.log(`\n- ${f.id}`);
        console.log(`  frase: ${f.frase}`);
        console.log(`  campo afetado: ${f.campo}`);
        console.log(`  esperado: ${f.esperado}`);
        console.log(`  recebido: ${f.recebido}`);
      }
    }
    console.log("====================================================\n");
  });
});
