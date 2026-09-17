/**
 * Live Llama: regressão dos 5 failures do estresse (contratos arquiteturais).
 * Rode: node --test testes/backend/creation-stress-regression-live.test.js
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { interpretCreationMessage, isCreationLlmInterpretEnabled } from "../../backend/src/services/creationLlmInterpret.js";
import { emptyCreationState } from "../../backend/src/services/chatCreationInterpret.js";
import {
  applyProductMediaGate,
  buildCreationProductCandidate,
  resolveProductFromAcervo,
} from "../../backend/src/services/productAcervoResolve.js";
import { isCreationLlmOllama } from "../../backend/src/config.js";
import {
  EMPRESA_ALIMENTOS,
  EMPRESA_ELETRONICOS,
  EMPRESA_ROUPAS,
  toTenantMidias,
} from "./fixtures/acervo-varejo-multiempresa.fixture.js";

const RESULTS = [];

function midiaIds(matches) {
  return (matches || []).map((r) => String(r.id_midia ?? r.id ?? "")).sort();
}

async function turn(message, opts = {}) {
  const midias = opts.midias;
  const prevState = opts.prevState || emptyCreationState();
  const history = opts.history || [];
  const interpret = await interpretCreationMessage({ message, prevState, history });
  const entities = {
    produto: interpret.trace?.llm_interpretation?.entities?.produto ?? interpret.state?.produto ?? null,
    produto_referencia: interpret.trace?.llm_interpretation?.entities?.produto_referencia ?? null,
    sabor: interpret.trace?.llm_interpretation?.entities?.sabor ?? null,
    atributos: interpret.trace?.llm_interpretation?.entities?.atributos ?? [],
  };
  if (!entities.produto && interpret.state?.produto) entities.produto = interpret.state.produto;
  const candidate = buildCreationProductCandidate({
    entities,
    message,
    midiaRows: midias,
    stateProduto: interpret.state?.produto || prevState?.produto || null,
  });
  const resolved = resolveProductFromAcervo(candidate, midias);
  const hist = [...history, { role: "user", content: message }];
  const gate = applyProductMediaGate({}, midias, message, hist, { entities });
  console.log(`[REG] ${message.slice(0, 60)} → prod=${interpret.state?.produto || "∅"} resolve=${resolved.status} ids=${midiaIds(resolved.matches)}`);
  return { interpret, candidate, resolved, gate };
}

function caseTest(id, fn) {
  it(id, async () => {
    try {
      await fn();
      RESULTS.push({ id, ok: true });
    } catch (err) {
      RESULTS.push({ id, ok: false, detail: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  });
}

describe("regressão live — 5 failures do estresse", () => {
  it("pré-condições", async (t) => {
    if (!isCreationLlmInterpretEnabled() || !isCreationLlmOllama()) {
      t.skip("Ollama + CHAT_CREATION_LLM_INTERPRET necessários");
      return;
    }
    assert.equal(true, true);
  });

  caseTest("R1 quebrada → fone bluetooth preservado", async () => {
    const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
    const steps = ["quero", "uma arte", "desse fone bluetooth", "com preço", "59,90", "mais premium"];
    let state = emptyCreationState();
    let history = [];
    let last;
    for (const msg of steps) {
      last = await turn(msg, { midias, prevState: state, history });
      state = last.interpret.state;
      history = [...history, { role: "user", content: msg }];
    }
    assert.match(String(state.produto), /fone|bluetooth/i);
    assert.equal(last.resolved.status, "matched");
    assert.deepEqual(midiaIds(last.resolved.matches), ["fone-bluetooth"]);
  });

  caseTest("R2 notebook escritório → notebook-14", async () => {
    const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
    const out = await turn("coloca o notebook 14 no escritório e faz uma divulgação dele", { midias });
    assert.equal(out.resolved.status, "matched");
    assert.deepEqual(midiaIds(out.resolved.matches), ["notebook-14"]);
  });

  caseTest("R3 divulgação bonita → sem matched", async () => {
    const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
    const out = await turn("faz uma divulgação bonita", { midias });
    assert.notEqual(out.resolved.status, "matched");
    assert.equal((out.gate.proposal.midias_referenced || []).length, 0);
  });

  caseTest("R4 natural + ok resumo preserva café", async () => {
    const midias = toTenantMidias(EMPRESA_ALIMENTOS.midias);
    const steps = [
      "quero divulgar um produto",
      "o café torrado",
      "clima de inverno",
      "preço 24,90",
      "mais aconchegante",
      "fundo de cozinha",
      "ok pode montar o resumo",
    ];
    let state = emptyCreationState();
    let history = [];
    let last;
    for (const msg of steps) {
      last = await turn(msg, { midias, prevState: state, history });
      state = last.interpret.state;
      history = [...history, { role: "user", content: msg }];
    }
    assert.match(String(state.produto), /cafe|café/i);
    assert.ok(!/ok|resumo/i.test(String(state.produto)));
    assert.equal(last.resolved.status, "matched");
    assert.deepEqual(midiaIds(last.resolved.matches), ["cafe-torrado"]);
  });

  caseTest("R5 arte disso → sem matched", async () => {
    const midias = toTenantMidias(EMPRESA_ROUPAS.midias);
    const out = await turn("faz uma arte disso", { midias });
    assert.notEqual(out.resolved.status, "matched");
    assert.equal((out.gate.proposal.midias_referenced || []).length, 0);
  });
});

after(() => {
  const passed = RESULTS.filter((r) => r.ok).length;
  console.log(`\n========== REGRESSÃO LIVE 5 FAILURES ==========`);
  console.log(`Passaram: ${passed}/${RESULTS.length}`);
  for (const f of RESULTS.filter((r) => !r.ok)) console.log(`- FAIL ${f.id}: ${f.detail}`);
  console.log("==============================================\n");
});
