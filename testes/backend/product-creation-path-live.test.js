/**
 * Integração do caminho real de criação (sem gerar imagem):
 * mensagem → interpretCreationMessage (Llama/Ollama) → ProductCandidate → resolveProductFromAcervo → gate
 *
 * Requer: Ollama em LLAMA_BASE_URL + CHAT_CREATION_LLM_INTERPRET=true
 * Rode: node --test testes/backend/product-creation-path-live.test.js
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { interpretCreationMessage, isCreationLlmInterpretEnabled } from "../../backend/src/services/creationLlmInterpret.js";
import { emptyCreationState } from "../../backend/src/services/chatCreationInterpret.js";
import {
  applyProductMediaGate,
  buildCreationProductCandidate,
  resolveProductFromAcervo,
  toProductCandidate,
} from "../../backend/src/services/productAcervoResolve.js";
import { isCreationLlmOllama } from "../../backend/src/config.js";

/** Acervo do tenant (só o que está cadastrado — nunca inventar). */
const TENANT_MIDIAS = [
  {
    id_midia: "pf-morango",
    nome_exibicao: "pro force morango",
    nome_arquivo: "pro-force-morango.png",
    tipo_midia: "imagem",
  },
  {
    id_midia: "pf-chocolate",
    nome_exibicao: "pro force chocolate",
    nome_arquivo: "pro-force-chocolate.png",
    tipo_midia: "imagem",
  },
  {
    id_midia: "creatina-limao",
    nome_exibicao: "creatina limao",
    nome_arquivo: "creatina-limao.png",
    descricao: "creatina sabor limao",
    tipo_midia: "imagem",
  },
  {
    id_midia: "creatina-max",
    nome_exibicao: "creatina max",
    nome_arquivo: "creatina-max.png",
    tipo_midia: "imagem",
  },
  {
    id_midia: "creatina-growth",
    nome_exibicao: "creatina growth",
    nome_arquivo: "creatina-growth.png",
    tipo_midia: "imagem",
  },
  {
    id_midia: "whey-chocolate",
    nome_exibicao: "whey growth chocolate",
    nome_arquivo: "whey-growth-chocolate.png",
    tipo_midia: "imagem",
  },
];

/** @type {{ id: string, ok: boolean, detail?: string, trace?: unknown }[]} */
const RESULTS = [];

function midiaIds(matches) {
  return (matches || []).map((r) => String(r.id_midia ?? r.id ?? "")).sort();
}

function entitiesFromInterpret(out) {
  const llm = out?.trace?.llm_interpretation?.entities;
  if (llm && typeof llm === "object") {
    return {
      produto: llm.produto ?? null,
      produto_referencia: llm.produto_referencia ?? null,
      sabor: llm.sabor ?? null,
      atributos: Array.isArray(llm.atributos) ? llm.atributos : [],
    };
  }
  const st = out?.state || emptyCreationState();
  return {
    produto: st.produto || null,
    produto_referencia: null,
    sabor: st.sabor || null,
    atributos: st.sabor ? [st.sabor] : [],
  };
}

/**
 * Caminho real: LLM interpreta → candidato → só o acervo valida mídia.
 * @param {string} message
 * @param {{ prevState?: object, history?: Array<{role:string,content:string}>, midias?: typeof TENANT_MIDIAS }} [opts]
 */
async function runCreationPath(message, opts = {}) {
  const midias = opts.midias || TENANT_MIDIAS;
  const history = Array.isArray(opts.history) ? opts.history : [];
  const prevState = opts.prevState || emptyCreationState();

  const interpret = await interpretCreationMessage({
    message,
    prevState,
    history,
  });

  const entities = entitiesFromInterpret(interpret);
  if (!entities.produto && interpret.state?.produto) {
    entities.produto = interpret.state.produto;
  }
  const fromEntitiesOnly = toProductCandidate(entities, { acervoRows: midias });
  const candidate = buildCreationProductCandidate({
    entities,
    message,
    midiaRows: midias,
    stateProduto: interpret.state?.produto || prevState?.produto || null,
  });
  const resolved = resolveProductFromAcervo(candidate, midias);
  const histForGate = [...history, { role: "user", content: message }];
  const gate = applyProductMediaGate({}, midias, message, histForGate, { entities });

  const trace = {
    message,
    source: interpret.trace?.source,
    entities,
    candidate_from_entities: fromEntitiesOnly,
    candidate_effective: candidate,
    resolve_status: resolved.status,
    resolve_ids: midiaIds(resolved.matches),
    resolve_ask: resolved.ask || null,
    gate_status: gate.proposal?.product_media_status,
    gate_blocked: gate.blocked,
    gate_ids: (gate.proposal?.midias_referenced || []).map((m) => m.id_midia).sort(),
    gate_ask: gate.confirmation_message || null,
    state_after: interpret.state,
    briefing: {
      intencao: interpret.state?.intencao || "",
      estilo: interpret.state?.estilo || "",
      oferta: interpret.state?.oferta || "",
      cenario: interpret.state?.cenario || "",
      tema: interpret.state?.tema || "",
    },
  };

  console.log(`\n[CREATION-PATH] ${message.slice(0, 72)}${message.length > 72 ? "…" : ""}`);
  console.log(JSON.stringify(trace, null, 2));

  return { interpret, entities, candidate, resolved, gate, trace };
}

function caseTest(id, fn) {
  it(id, async () => {
    try {
      await fn();
      RESULTS.push({ id, ok: true });
    } catch (err) {
      RESULTS.push({
        id,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });
}

describe("criação — caminho real (Llama) + resolução de acervo", () => {
  it("pré-condições: interpretador Llama ligado", async (t) => {
    if (!isCreationLlmInterpretEnabled()) {
      t.skip("CHAT_CREATION_LLM_INTERPRET=true necessário");
      return;
    }
    if (!isCreationLlmOllama()) {
      t.skip("CHAT_CREATION_LLM_PROVIDER=ollama necessário nesta bateria");
      return;
    }
    assert.equal(isCreationLlmInterpretEnabled(), true);
  });

  caseTest("1) produto explícito: Pro Force de morango", async () => {
    const msg = "Quero uma campanha do Pro Force de morango, moderna e chamativa.";
    const { resolved, gate, candidate, trace } = await runCreationPath(msg);

    assert.ok(
      candidate.nome || candidate.atributos?.length,
      "candidato deve vir da interpretação, não vazio",
    );
    assert.doesNotMatch(String(candidate.nome || ""), /moderno|chamativ|campanha/i);
    assert.equal(resolved.status, "matched");
    assert.deepEqual(midiaIds(resolved.matches), ["pf-morango"]);
    assert.equal(gate.proposal.product_media_status, "matched");
    assert.deepEqual(
      (gate.proposal.midias_referenced || []).map((m) => m.id_midia),
      ["pf-morango"],
    );
    assert.ok(trace.source === "llm" || trace.source === "deterministic");
  });

  caseTest("2) briefing longo: só Pro Force + morango na busca", async () => {
    const msg =
      "Quero uma arte do Pro Force de morango, com clima de verão, fundo de academia, preço grande, espaço para chamada e estética moderna.";
    const { resolved, candidate, gate } = await runCreationPath(msg);

    const blob = JSON.stringify({ candidate, resolved }).toLowerCase();
    assert.doesNotMatch(blob, /"espaco"|"lancamento"/);
    assert.ok(!/\bespaco\b/.test(String(candidate.nome || "")));
    assert.ok(!/\bverao\b/.test(String(candidate.nome || "")));
    assert.ok(!/\bacademia\b/.test(String(candidate.nome || "")));
    assert.ok(!/\bmoderno\b/.test(String(candidate.nome || "")));

    assert.equal(resolved.status, "matched");
    assert.deepEqual(midiaIds(resolved.matches), ["pf-morango"]);
    assert.equal(gate.proposal.product_media_status, "matched");
  });

  caseTest("3) referência descritiva: creatina de limão cadastrada", async () => {
    const msg = "Quero usar aquela creatina de limão que está cadastrada.";
    const { resolved, gate } = await runCreationPath(msg);

    assert.equal(resolved.status, "matched");
    assert.deepEqual(midiaIds(resolved.matches), ["creatina-limao"]);
    assert.equal(gate.blocked, false);
    assert.ok(
      !(gate.proposal.midias_referenced || []).some((m) => !TENANT_MIDIAS.some((r) => r.id_midia === m.id_midia)),
      "só mídias reais do tenant",
    );
  });

  caseTest("4) produto inexistente → missing", async () => {
    const msg = "Quero uma arte do Produto X de chocolate.";
    const { resolved, gate, candidate } = await runCreationPath(msg);

    // Pode cair em not_requested se LLM não extrair produto; ou missing se extrair e não achar.
    assert.ok(
      ["missing", "not_requested"].includes(resolved.status),
      `esperado missing|not_requested, veio ${resolved.status}`,
    );
    if (resolved.status === "missing") {
      assert.equal(resolved.matches.length, 0);
      assert.equal(gate.blocked, true);
      assert.equal(gate.proposal.product_media_status, "missing");
    }
    assert.equal((gate.proposal.midias_referenced || []).length, 0);
    assert.ok(!String(candidate.nome || "").match(/^[0-9a-f-]{36}$/i), "nunca inventar UUID");
  });

  caseTest("5) ambiguidade: creatina genérica → ambiguous", async () => {
    const msg = "Quero uma arte da creatina que temos no acervo.";
    const { resolved, gate } = await runCreationPath(msg);

    assert.ok(
      ["ambiguous", "matched"].includes(resolved.status),
      `status=${resolved.status}`,
    );
    if (resolved.status === "ambiguous") {
      assert.ok(resolved.matches.length >= 2);
      assert.match(String(resolved.ask || gate.confirmation_message || ""), /mais de um|qual/i);
      const labels = (resolved.matches || [])
        .map((r) => String(r.nome_exibicao || ""))
        .join(" ");
      assert.match(labels, /creatina/i);
      assert.equal(gate.blocked, true);
      assert.equal(gate.proposal.product_media_status, "ambiguous");
      assert.equal((gate.proposal.midias_referenced || []).length, 0);
    } else {
      // Se o LLM/inferência afunilou para uma só, ainda precisa ser mídia real do tenant.
      assert.equal(resolved.matches.length, 1);
      assert.ok(midiaIds(resolved.matches)[0].startsWith("creatina-"));
    }
  });

  caseTest("6) criativo sem produto: espaço/lançamento não viram candidato", async () => {
    const msg = "Quero uma arte com espaço para chamada e clima de lançamento.";
    const { resolved, gate, candidate, entities } = await runCreationPath(msg);

    assert.ok(!/\bespaco\b/i.test(String(candidate.nome || "")));
    assert.ok(!/\blancamento\b/i.test(String(candidate.nome || "")));
    assert.ok(
      resolved.status === "not_requested" ||
        (resolved.status === "missing" && !candidate.nome),
      `não deve matchar mídia por criativo; status=${resolved.status} nome=${candidate.nome}`,
    );
    assert.equal((gate.proposal.midias_referenced || []).length, 0);
    if (entities.produto) {
      assert.doesNotMatch(String(entities.produto), /^(espaco|lancamento)$/i);
    }
  });

  caseTest("7) multi-turno: produto depois só preço/estilo", async () => {
    const msg1 = "Quero uma campanha do Pro Force de morango.";
    const turn1 = await runCreationPath(msg1);
    assert.equal(turn1.resolved.status, "matched");
    assert.deepEqual(midiaIds(turn1.resolved.matches), ["pf-morango"]);

    const msg2 = "Coloca o preço em 9,99 e deixa mais moderno.";
    const turn2 = await runCreationPath(msg2, {
      prevState: turn1.interpret.state,
      history: [{ role: "user", content: msg1 }],
    });

    assert.ok(turn2.interpret.state.produto, "produto preservado no estado");
    assert.match(String(turn2.interpret.state.produto), /pro|force|morango/i);
    assert.ok(turn2.interpret.state.oferta || /9[,.]99/.test(msg2));

    // Resolução no 2º turno ainda deve usar o produto, não o briefing de preço/estilo.
    assert.equal(turn2.resolved.status, "matched");
    assert.deepEqual(midiaIds(turn2.resolved.matches), ["pf-morango"]);
    assert.doesNotMatch(String(turn2.candidate.nome || ""), /moderno|preco|9/);
  });

  caseTest("8) troca de produto: whey → creatina (só se resolver no acervo)", async () => {
    const msg1 = "Monta um post do whey growth chocolate com promoção.";
    const turn1 = await runCreationPath(msg1);
    assert.equal(turn1.resolved.status, "matched");
    assert.deepEqual(midiaIds(turn1.resolved.matches), ["whey-chocolate"]);

    const ofertaAntes = turn1.interpret.state.oferta;
    const msg2 = "Em vez do whey, usa a creatina limão.";
    const turn2 = await runCreationPath(msg2, {
      prevState: turn1.interpret.state,
      history: [{ role: "user", content: msg1 }],
    });

    assert.equal(turn2.resolved.status, "matched");
    assert.deepEqual(midiaIds(turn2.resolved.matches), ["creatina-limao"]);
    assert.deepEqual(
      (turn2.gate.proposal.midias_referenced || []).map((m) => m.id_midia),
      ["creatina-limao"],
    );
    // Briefing residual: intenção/oferta não precisam sumir só porque trocou produto.
    if (ofertaAntes) {
      assert.ok(turn2.interpret.state.oferta || turn2.interpret.state.intencao !== undefined);
    }
  });
});

after(() => {
  const passed = RESULTS.filter((r) => r.ok).length;
  const failed = RESULTS.filter((r) => !r.ok);
  console.log("\n========== RESUMO CRIAÇÃO PATH LIVE ==========");
  console.log(`Total: ${RESULTS.length}`);
  console.log(`Passaram: ${passed}`);
  console.log(`Falharam: ${failed.length}`);
  for (const f of failed) {
    console.log(`- FAIL ${f.id}: ${f.detail}`);
  }
  console.log("==============================================\n");
});
