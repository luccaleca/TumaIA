/**
 * Interpretação semântica de criação via LLM (somente entender).
 * Validação, estado, brief e payload continuam determinísticos.
 */
import { z } from "zod";
import { env, isCreationLlmOllama } from "../config.js";
import { parseJsonFromLlmContent } from "./llamaJsonParse.js";
import { llamaChatCompletionJson } from "./llamaOpenAiClient.js";
import { promptCloudChat } from "./cloudChatService.js";
import {
  CreationLlmInterpretSchema,
  parseCreationLlmInterpret,
} from "./creationInterpretSchema.js";
import {
  parseCreationTurn,
  mergeCreationState,
  emptyCreationState,
  extractOfferFromText,
  extractScenarioFromText,
  extractStyleTermsFromText,
  extractFlavorFromText,
  refineProductQuery,
  looksLikeProductCandidate,
  normalizeCreationText,
  isCreationFlowMetaUtterance,
  isVagueProductReference,
} from "./chatCreationInterpret.js";
import { isCreativeBriefingToken } from "./productAcervoResolve.js";
import { buildArteBriefFromHistory } from "./rawImageArteBrief.js";

/**
 * Prompt: modelo de dados + regras semânticas — sem catálogo de frases.
 */
export function buildCreationInterpretPrompt({ message, prevState, historyTail }) {
  const prev = prevState && typeof prevState === "object" ? prevState : emptyCreationState();
  const hist = Array.isArray(historyTail)
    ? historyTail
        .slice(-4)
        .map((h) => `${h.role === "assistant" ? "Tuma" : "Usuário"}: ${String(h.content || "").trim()}`)
        .filter((l) => l.length > 10)
        .join("\n")
    : "";

  return [
    "Você interpreta pedidos de criação de arte publicitária em português do Brasil.",
    "Sua única tarefa: entender a mensagem e devolver JSON no schema abaixo.",
    "Você NÃO decide o estado da aplicação; apenas descreve o que o usuário quis dizer.",
    "",
    "SCHEMA JSON (responda só com um objeto JSON válido):",
    JSON.stringify(
      {
        entities: {
          produto: "string|null — nome/linha do produto; null se só houver referência vaga",
          produto_referencia:
            "string|null — descrição ambígua para o código resolver no acervo (ex. cor/embalagem)",
          sabor: "string|null — sabor/variante do produto se mencionado",
          atributos: ["outros atributos de produto: cor, gramatura, etc. — nunca estilo/preço"],
          cenario: "string|null — lugar/ambiente visual (normalize para rótulo curto se possível)",
          tema: "string|null — campanha/estação/assunto",
          oferta: "string|null — preço/oferta só se o usuário mencionou valor",
          estilo: ["direções estéticas mencionadas"],
          destaque: "string|null — o que deve chamar atenção (ex. preço)",
          formato: "string|null — ratio ou nome de formato se pedido",
          intencao: "string|null — promocao|campanha|lancamento|arte|divulgacao|…",
        },
        suggested_operation: {
          type: "set|patch|replace_product|clarify_product",
          fields: ["campos afetados"],
          interpretation_note: "frase curta sobre a intenção (não é comando de sistema)",
        },
        needs_product_clarification: false,
        ambiguities: [],
      },
      null,
      2,
    ),
    "",
    "REGRAS SEMÂNTICAS:",
    "1. Extraia entidades e relações; generalize paráfrases e linguagem coloquial.",
    "2. Nunca invente produto, preço, característica comercial, UUID ou dado de acervo.",
    "3. Se o preço/número aparecer na mensagem, preencha oferta; senão oferta=null.",
    "4. Referência vaga a produto (sem nome seguro) → needs_product_clarification=true,",
    "   produto=null, e se houver pista descritiva use produto_referencia.",
    "5. Sinônimos de lugar (ex. academia/treino/praia/beach) → cenario canônico curto.",
    "6. Estilo: direção estética (mood/época). NÃO coloque estilo, intenção, preço ou",
    "   'espaço para chamada' em produto/sabor/atributos.",
    "7. Se a mensagem só altera parte do briefing já existente, type=patch e liste fields.",
    "8. Se o usuário pede troca de produto, type=replace_product e preencha produto novo.",
    "9. Diferencie interpretação (o que parece querer) de decisão (quem aplica é o código).",
    "10. Responda APENAS JSON, sem markdown e sem texto fora do objeto.",
    "",
    `Estado acumulado atual (somente contexto; não copie cegamente): ${JSON.stringify({
      produto: prev.produto || null,
      cenario: prev.cenario || null,
      oferta: prev.oferta || null,
      estilo: prev.estilo || null,
      destaque: prev.destaque || null,
      tema: prev.tema || null,
      intencao: prev.intencao || null,
    })}`,
    hist ? `Histórico recente:\n${hist}` : "Histórico recente: (vazio)",
    `Mensagem do usuário: ${String(message || "").trim()}`,
  ].join("\n");
}

/**
 * @param {string} message
 * @param {import("./creationInterpretSchema.js").CreationLlmInterpret} data
 * @param {ReturnType<typeof emptyCreationState> | null} [prevState]
 */
export function validateInterpretationAgainstMessage(message, data, prevState = null) {
  const n = normalizeCreationText(message);
  const errors = [];
  const entities = data.entities || {};
  const opType = data.suggested_operation?.type || "set";
  const prevProduto = normalizeCreationText(prevState?.produto || "");

  if (entities.oferta) {
    const fromMsg = extractOfferFromText(message);
    const offerNorm = normalizeCreationText(entities.oferta);
    const hasDigits = /\d/.test(offerNorm);
    const digitsInMsg = /\d{1,6}(?:[.,]\d{1,2})?/.test(n);
    if (!hasDigits || (!fromMsg && !digitsInMsg)) {
      errors.push("oferta não sustentada pela mensagem");
    }
  }

  if (entities.produto) {
    const p = normalizeCreationText(entities.produto);
    const tokens = p.split(/\s+/).filter((t) => t.length >= 3);
    const mentioned = tokens.some((t) => n.includes(t));
    const fromPrev =
      (opType === "patch" || opType === "replace_product") &&
      prevProduto &&
      (p === prevProduto || prevProduto.includes(p) || p.includes(prevProduto));
    // produto_referencia não autoriza inventar outro nome fora da mensagem.
    if (!mentioned && !fromPrev) {
      if (!/\b(outro|outra|esse|essa|aquele|aquela)\b/.test(n)) {
        errors.push("produto não mencionado na mensagem");
      } else {
        errors.push("produto ambíguo sem nome explícito");
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Normaliza entidades do LLM para um CreationTurn aplicável pelo merge determinístico.
 * @param {import("./creationInterpretSchema.js").CreationLlmInterpret} data
 * @param {string} message
 */
export function llmInterpretToCreationTurn(data, message) {
  const e = data.entities || {};
  const op = data.suggested_operation || { type: "set" };
  const vague =
    Boolean(data.needs_product_clarification) ||
    op.type === "clarify_product" ||
    Boolean(e.produto_referencia && !e.produto);

  let offer = "";
  if (e.oferta) {
    offer = extractOfferFromText(String(e.oferta)) || extractOfferFromText(message) || "";
    if (!offer && /\d/.test(String(e.oferta))) {
      const m = String(e.oferta).match(/(\d{1,6}(?:[.,]\d{1,2})?)/);
      if (m) offer = `R$${m[1]}`.replace(/R\$\s*/g, "R$");
    }
  } else {
    offer = extractOfferFromText(message);
  }

  let scenario = "";
  if (e.cenario) {
    scenario =
      extractScenarioFromText(String(e.cenario)) ||
      extractScenarioFromText(message) ||
      normalizeScenarioAlias(e.cenario);
  } else {
    scenario = extractScenarioFromText(message);
  }

  const styleFromLlm = Array.isArray(e.estilo)
    ? e.estilo.map((s) => String(s || "").trim()).filter(Boolean)
    : [];
  const style =
    styleFromLlm.length > 0 ? styleFromLlm : extractStyleTermsFromText(message);

  let productQuery = null;
  if (!vague && e.produto) {
    const cleaned = refineProductQuery(e.produto);
    if (
      cleaned &&
      looksLikeProductCandidate(cleaned) &&
      !isCreativeBriefingToken(cleaned)
    ) {
      productQuery = cleaned;
    }
  }
  // Completa produto só em set/replace — em patch o código preserva o estado.
  if (!vague && !productQuery && (op.type === "set" || op.type === "replace_product")) {
    const det = parseCreationTurn(message);
    if (
      det.productQuery &&
      looksLikeProductCandidate(det.productQuery) &&
      !isCreativeBriefingToken(det.productQuery)
    ) {
      productQuery = det.productQuery;
    }
  }

  const flavor =
    (e.sabor && String(e.sabor).trim()) ||
    extractFlavorFromText(message) ||
    "";
  const attrExtra = Array.isArray(e.atributos)
    ? e.atributos.map((a) => String(a || "").trim()).filter(Boolean)
    : [];

  const layout =
    e.destaque ||
    (offer && /\b(destaque|grande|cima|chamativ|aten)/i.test(normalizeCreationText(message))
      ? "preço em destaque"
      : "");

  /** @type {ReturnType<typeof parseCreationTurn>} */
  const turn = {
    slashProducts: [],
    productHints: productQuery ? [productQuery] : [],
    productQuery,
    intent: e.intencao || "",
    theme: e.tema || "",
    offer,
    style,
    layout: layout || "",
    flavor,
    scenario: scenario || "",
    characteristic: attrExtra.filter((a) => a !== flavor).join(", "),
    composition: "",
    isRevisionOnly: op.type === "patch",
    isBareSelection: false,
    needsProductClarification: vague,
    needsAcervoLookup: Boolean(productQuery || e.produto_referencia || flavor),
    substitution:
      op.type === "replace_product" && productQuery
        ? { from: "", to: productQuery }
        : null,
    operation: {
      type:
        op.type === "replace_product"
          ? "replace_product"
          : op.type === "patch"
            ? "patch"
            : "set",
      product: productQuery,
      suppressNoisyProduct: op.type === "patch",
    },
    produto_referencia: e.produto_referencia || null,
    formato_hint: e.formato || null,
    interpretation_note: op.interpretation_note || null,
    source: "llm",
  };
  return turn;
}

/**
 * @param {string} raw
 */
function normalizeScenarioAlias(raw) {
  const n = normalizeCreationText(raw);
  if (!n) return "";
  if (/\b(beach|praia|areia|litoral)\b/.test(n)) return "praia";
  if (/\b(gym|academia|treino|fitness|malhacao|malhar)\b/.test(n)) return "academia";
  if (/\b(studio|estudio)\b/.test(n)) return "estúdio";
  // Rótulo curto livre (máx. 2 tokens) se parecer lugar.
  const words = n.split(/\s+/).filter(Boolean).slice(0, 2);
  if (words.length && words.join(" ").length <= 24) return words.join(" ");
  return "";
}

/**
 * Chamada LLM (cloud ou ollama). Injável via completeFn nos testes.
 * @param {{
 *   message: string,
 *   prevState?: ReturnType<typeof emptyCreationState>,
 *   history?: Array<{ role?: string, content?: string }>,
 *   completeFn?: (prompt: string) => Promise<string>,
 * }} input
 */
export async function requestCreationLlmInterpretation(input) {
  const message = String(input.message || "").trim();
  if (!message) return { ok: false, error: "mensagem vazia", raw: null };

  const prompt = buildCreationInterpretPrompt({
    message,
    prevState: input.prevState,
    historyTail: input.history,
  });

  let content = "";
  try {
    if (typeof input.completeFn === "function") {
      content = String(await input.completeFn(prompt));
    } else if (!isCreationLlmInterpretEnabled()) {
      return { ok: false, error: "CHAT_CREATION_LLM_INTERPRET desligado", raw: null };
    } else if (!isCreationLlmOllama()) {
      const out = await promptCloudChat({
        question: prompt,
        history: [],
        nomeFantasia: null,
        chat_mode: "identidade",
        trainingBlock: "",
      });
      content = String(out?.text || "");
    } else {
      const out = await llamaChatCompletionJson(prompt, {
        temperature: 0.1,
        model: String(env.LLAMA_MODEL || env.OLLAMA_CHAT_MODEL || "").trim() || undefined,
        timeoutMs: Math.min(Number(env.CHAT_CREATION_LLM_TIMEOUT_MS || 90_000), 180_000),
      });
      content =
        out?.rawContent ||
        (out?.parsed && typeof out.parsed === "object"
          ? JSON.stringify(out.parsed)
          : "");
      if (out?.parsed && typeof out.parsed === "object") {
        const validatedEarly = parseCreationLlmInterpret(out.parsed);
        if (validatedEarly.ok) {
          return { ok: true, data: validatedEarly.data, raw: out.parsed, prompt };
        }
      }
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      raw: null,
    };
  }

  const json = parseJsonFromLlmContent(content);
  if (!json.ok) {
    return { ok: false, error: "JSON inválido do interpretador", raw: content };
  }
  const validated = parseCreationLlmInterpret(json.parsed);
  if (!validated.ok) {
    return { ok: false, error: validated.error, raw: json.parsed };
  }
  return { ok: true, data: validated.data, raw: json.parsed, prompt };
}

/**
 * @returns {boolean}
 */
export function isCreationLlmInterpretEnabled() {
  return env.CHAT_CREATION_LLM_INTERPRET === true;
}

/**
 * Pipeline completo: LLM → validação → merge determinístico → brief.
 * Fallback automático para parseCreationTurn se LLM falhar.
 *
 * @param {{
 *   message: string,
 *   prevState?: ReturnType<typeof emptyCreationState>,
 *   history?: Array<{ role?: string, content?: string }>,
 *   completeFn?: (prompt: string) => Promise<string>,
 *   forceDeterministic?: boolean,
 * }} input
 */
export async function interpretCreationMessage(input) {
  const message = String(input.message || "").trim();
  const prev = { ...emptyCreationState(), ...(input.prevState || {}) };
  const history = Array.isArray(input.history) ? input.history : [];

  /** @type {Record<string, unknown>} */
  const trace = {
    message,
    state_before: { ...prev },
    llm_interpretation: null,
    suggested_operation: null,
    validation: null,
    source: "deterministic",
    state_after: null,
    arte_brief: null,
  };

  if (!input.forceDeterministic) {
    const llm = await requestCreationLlmInterpretation({
      message,
      prevState: prev,
      history,
      completeFn: input.completeFn,
    });

    if (llm.ok && llm.data) {
      const gate = validateInterpretationAgainstMessage(message, llm.data, prev);
      trace.llm_interpretation = llm.data;
      trace.suggested_operation = llm.data.suggested_operation;
      trace.validation = gate;

      if (gate.ok) {
        // Meta de fluxo: não deixa o LLM sobrescrever produto com «ok/resumo».
        if (isCreationFlowMetaUtterance(message)) {
          const metaTurn = parseCreationTurn(message);
          const next = mergeCreationState(prev, metaTurn, message);
          trace.source = "deterministic";
          trace.suggested_operation = metaTurn.operation || { type: "patch" };
          trace.state_after = { ...next };
          trace.arte_brief = buildArteBriefFromHistory(
            [...history, { role: "user", content: message }],
            [],
          );
          return { ok: true, state: next, turn: metaTurn, trace };
        }

        const turn = llmInterpretToCreationTurn(llm.data, message);
        if (turn.productQuery && !looksLikeProductCandidate(turn.productQuery)) {
          turn.productQuery = null;
          turn.productHints = [];
        }
        // Estado vazio + produto na mensagem: decisão de sistema é set (mesmo se LLM disse patch).
        if (!prev.produto) {
          if (!turn.productQuery) {
            const det = parseCreationTurn(message);
            const cand = det.productQuery ? refineProductQuery(det.productQuery) : "";
            if (
              cand &&
              looksLikeProductCandidate(cand) &&
              cand.split(/\s+/).length <= 3
            ) {
              turn.productQuery = cand;
              turn.productHints = [cand];
            }
          }
          if (turn.productQuery && turn.operation?.type === "patch") {
            turn.isRevisionOnly = false;
            turn.operation = {
              type: "set",
              product: turn.productQuery,
              suppressNoisyProduct: false,
            };
          }
        }
        // Decisão de sistema: código aplica merge (LLM não altera estado direto).
        const next = mergeCreationState(prev, turn, message);
        if (turn.needsProductClarification) {
          // Não inventar produto no estado.
          next.produto = prev.produto || "";
        }
        // Mensagem com nome concreto: se o estado ficou sem produto, completa pelo determinístico.
        if (!next.produto) {
          const det = parseCreationTurn(message);
          const cand = det.productQuery ? refineProductQuery(det.productQuery) || det.productQuery : "";
          if (cand && looksLikeProductCandidate(cand)) {
            next.produto = cand;
          }
        }
        // Produto concreto no estado → não manter pedido de esclarecimento.
        if (next.produto && looksLikeProductCandidate(next.produto) && !isVagueProductReference(message)) {
          turn.needsProductClarification = false;
        }
        trace.source = "llm";
        trace.state_after = { ...next };
        const histForBrief = [...history, { role: "user", content: message }];
        const syntheticContent = [
          next.produto && `produto ${next.produto}`,
          next.cenario && `cenário ${next.cenario}`,
          next.oferta && `preço ${next.oferta}`,
          next.estilo && `estilo ${next.estilo}`,
          next.destaque && next.destaque,
          next.tema && `tema ${next.tema}`,
        ]
          .filter(Boolean)
          .join(", ");
        if (syntheticContent) {
          trace.arte_brief = buildArteBriefFromHistory(
            [{ role: "user", content: syntheticContent }],
            [],
          );
        } else if (!turn.needsProductClarification) {
          trace.arte_brief = buildArteBriefFromHistory(histForBrief, []);
        } else {
          trace.arte_brief = {
            tema: "",
            texto: "",
            estilo: "",
            observacoes: "aguardando identificação do produto",
          };
        }
        if (
          next.oferta &&
          trace.arte_brief &&
          !String(trace.arte_brief.texto || "").includes(
            String(next.oferta).replace(/[^\d]/g, "").slice(0, 2),
          )
        ) {
          trace.arte_brief = {
            ...trace.arte_brief,
            texto: next.oferta,
            tema: [trace.arte_brief.tema, next.oferta].filter(Boolean).join(" · "),
          };
        }
        return {
          ok: true,
          state: next,
          turn,
          trace,
        };
      }
    } else {
      trace.validation = { ok: false, errors: [llm.error || "llm indisponível"] };
    }
  }

  // Fallback determinístico
  const turn = parseCreationTurn(message);
  const next = mergeCreationState(prev, turn, message);
  trace.source = "deterministic";
  trace.llm_interpretation = null;
  trace.suggested_operation = turn.operation || null;
  trace.state_after = { ...next };
  trace.arte_brief = buildArteBriefFromHistory(
    [...history, { role: "user", content: message }],
    [],
  );
  return { ok: true, state: next, turn, trace };
}

// Re-export schema helpers for tests
export { CreationLlmInterpretSchema, parseCreationLlmInterpret };
