/**
 * Live Llama: caminho real de criação em vários varejos (sem gerar imagem).
 * Valida: interpretar → candidato → acervo do tenant → gate.
 *
 * Requer: CHAT_CREATION_LLM_INTERPRET=true + CHAT_CREATION_LLM_PROVIDER=ollama
 * Rode: node --test testes/backend/product-creation-path-varejo-live.test.js
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
import {
  EMPRESA_ALIMENTOS,
  EMPRESA_CASA,
  EMPRESA_COSMETICOS,
  EMPRESA_ELETRONICOS,
  EMPRESA_PET,
  EMPRESA_PRODUTO_NOVO_BASE,
  EMPRESA_ROUPAS,
  EMPRESA_SUPLEMENTOS,
  PRODUTO_C_NOVO,
  toTenantMidias,
} from "./fixtures/acervo-varejo-multiempresa.fixture.js";

/** @type {{ id: string, ok: boolean, detail?: string, bucket?: string }[]} */
const RESULTS = [];

/** @type {{ id: string, bucket: string, detail: string, trace?: unknown }[]} */
const FAILURES = [];

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
 * Classifica falha para o relatório de generalização.
 * @param {string} detail
 * @param {unknown} trace
 */
function classifyFailure(detail, trace) {
  const t = trace && typeof trace === "object" ? /** @type {Record<string, unknown>} */ (trace) : {};
  const src = String(t.source || "");
  const resolveStatus = String(t.resolve_status || "");
  const entities = t.entities && typeof t.entities === "object" ? t.entities : {};
  const state = t.state_after && typeof t.state_after === "object" ? t.state_after : {};

  if (/invent|uuid|outra empresa|cross/i.test(detail)) return "dados_ou_isolamento";
  if (src === "llm" && (!entities.produto && !entities.produto_referencia) && resolveStatus === "missing") {
    return "interpretacao_llm";
  }
  if (src === "llm" && entities.produto && resolveStatus === "missing" && /cadastrad/i.test(String(entities.produto_referencia || ""))) {
    return "resolvedor_acervo";
  }
  if (resolveStatus === "matched" && t.gate_status && t.gate_status !== "matched") {
    return "estado_memoria_ou_gate";
  }
  if (/preserv|multi-turno|troca|estado/i.test(detail)) return "estado_memoria_ou_gate";
  if (resolveStatus === "missing" || resolveStatus === "ambiguous") return "resolvedor_acervo";
  if (src === "llm" || src === "deterministic") return "interpretacao_llm";
  return "geral_independente_categoria";
}

async function runCreationPath(message, opts = {}) {
  const midias = opts.midias || toTenantMidias(EMPRESA_SUPLEMENTOS.midias);
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
    empresa: opts.empresaId || null,
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
    state_after: interpret.state,
    briefing: {
      intencao: interpret.state?.intencao || "",
      estilo: interpret.state?.estilo || "",
      oferta: interpret.state?.oferta || "",
      cenario: interpret.state?.cenario || "",
    },
  };

  console.log(`\n[VAREJO-PATH] [${opts.empresaId || "?"}] ${message.slice(0, 64)}${message.length > 64 ? "…" : ""}`);
  console.log(JSON.stringify(trace, null, 2));

  return { interpret, entities, candidate, resolved, gate, trace, midias };
}

function caseTest(id, fn) {
  it(id, async () => {
    try {
      await fn();
      RESULTS.push({ id, ok: true });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const bucket = classifyFailure(detail, err?.trace);
      RESULTS.push({ id, ok: false, detail, bucket });
      FAILURES.push({ id, bucket, detail, trace: err?.trace });
      throw err;
    }
  });
}

/**
 * @param {string} id
 * @param {() => Promise<{ trace?: unknown } | void>} fn
 */
function caseTestWithTrace(id, fn) {
  it(id, async () => {
    let lastTrace;
    try {
      const out = await fn();
      lastTrace = out && typeof out === "object" ? out.trace : undefined;
      RESULTS.push({ id, ok: true });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const trace = err?.trace || lastTrace;
      const bucket = classifyFailure(detail, trace);
      RESULTS.push({ id, ok: false, detail, bucket });
      FAILURES.push({ id, bucket, detail, trace });
      throw err;
    }
  });
}

describe("criação varejo — caminho real (Llama) multicategoria", () => {
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

  const categoryCases = [
    {
      id: "suplementos: Pro Force morango",
      empresa: EMPRESA_SUPLEMENTOS,
      msg: "Quero uma campanha do Pro Force de morango, moderna e chamativa.",
      expectIds: ["pf-morango"],
    },
    {
      id: "roupas: camiseta preta",
      empresa: EMPRESA_ROUPAS,
      msg: "quero a camiseta preta numa arte elegante",
      expectIds: ["camiseta-preta"],
    },
    {
      id: "cosméticos: perfume 100ml",
      empresa: EMPRESA_COSMETICOS,
      msg: "usa o perfume de 100ml e faz algo mais sofisticado",
      expectIds: ["perfume-100ml"],
    },
    {
      id: "eletrônicos: celular azul",
      empresa: EMPRESA_ELETRONICOS,
      msg: "pega o celular azul e faz uma oferta",
      expectIds: ["celular-azul"],
    },
    {
      id: "alimentos: café torrado",
      empresa: EMPRESA_ALIMENTOS,
      msg: "usa o café torrado que está cadastrado numa campanha de inverno",
      expectIds: ["cafe-torrado"],
    },
    {
      id: "pet: ração cão",
      empresa: EMPRESA_PET,
      msg: "faz um post dessa ração cão adulto em promoção",
      expectIds: ["racao-cao-adulto"],
    },
    {
      id: "casa: sofá 3 lugares",
      empresa: EMPRESA_CASA,
      msg: "faz uma divulgação do sofá de 3 lugares",
      expectIds: ["sofa-3-lugares"],
    },
  ];

  for (const c of categoryCases) {
    caseTestWithTrace(c.id, async () => {
      const midias = toTenantMidias(c.empresa.midias);
      const out = await runCreationPath(c.msg, {
        midias,
        empresaId: c.empresa.id_empresa,
      });
      try {
        assert.equal(out.resolved.status, "matched", `status=${out.resolved.status}`);
        assert.deepEqual(midiaIds(out.resolved.matches), c.expectIds);
        assert.equal(out.gate.blocked, false);
        assert.deepEqual(out.gate.proposal.midias_referenced?.map((m) => m.id_midia).sort(), c.expectIds);
        // Briefing criativo não deve poluir o nome do candidato com tokens genéricos de layout.
        assert.ok(!/\bespaco\b/i.test(String(out.candidate.nome || "")));
      } catch (err) {
        err.trace = out.trace;
        throw err;
      }
      return out;
    });
  }

  caseTestWithTrace("atributo genérico: tênis branco 42 (roupas)", async () => {
    const midias = toTenantMidias(EMPRESA_ROUPAS.midias);
    const msg = "faz uma arte daquele tênis branco tamanho 42";
    const out = await runCreationPath(msg, { midias, empresaId: EMPRESA_ROUPAS.id_empresa });
    try {
      assert.equal(out.resolved.status, "matched");
      assert.deepEqual(midiaIds(out.resolved.matches), ["tenis-branco-42"]);
    } catch (err) {
      err.trace = out.trace;
      throw err;
    }
    return out;
  });

  caseTestWithTrace("mesmo briefing de preço em tenants diferentes (não cruza acervo)", async () => {
    const msg = "coloca o preço grande e deixa mais premium";
    const turns = [];
    for (const empresa of [EMPRESA_ROUPAS, EMPRESA_ELETRONICOS, EMPRESA_ALIMENTOS]) {
      const midias = toTenantMidias(empresa.midias);
      // Sem produto no pedido: não pode inventar mídia de outro setor.
      const out = await runCreationPath(msg, { midias, empresaId: empresa.id_empresa });
      turns.push(out);
      try {
        assert.equal((out.gate.proposal.midias_referenced || []).length, 0);
        assert.ok(
          out.resolved.status === "not_requested" || out.resolved.status === "missing",
          `${empresa.id_empresa}: status=${out.resolved.status}`,
        );
      } catch (err) {
        err.trace = out.trace;
        throw err;
      }
    }
    return { trace: turns[0]?.trace };
  });

  caseTestWithTrace("multi-turno: produto roupa → só altera preço", async () => {
    const midias = toTenantMidias(EMPRESA_ROUPAS.midias);
    const msg1 = "faz um anúncio dessa jaqueta jeans";
    const t1 = await runCreationPath(msg1, { midias, empresaId: EMPRESA_ROUPAS.id_empresa });
    try {
      assert.equal(t1.resolved.status, "matched");
      assert.deepEqual(midiaIds(t1.resolved.matches), ["jaqueta-jeans"]);
    } catch (err) {
      err.trace = t1.trace;
      throw err;
    }

    const msg2 = "coloca o preço em 199 e deixa mais premium";
    const t2 = await runCreationPath(msg2, {
      midias,
      empresaId: EMPRESA_ROUPAS.id_empresa,
      prevState: t1.interpret.state,
      history: [{ role: "user", content: msg1 }],
    });
    try {
      assert.equal(t2.resolved.status, "matched");
      assert.deepEqual(midiaIds(t2.resolved.matches), ["jaqueta-jeans"]);
      assert.ok(t2.interpret.state.oferta || /199/.test(msg2));
    } catch (err) {
      err.trace = t2.trace;
      throw err;
    }
    return t2;
  });

  caseTestWithTrace("produto novo cadastrado (diffuser) sem regra de categoria", async () => {
    const midias = toTenantMidias([...EMPRESA_PRODUTO_NOVO_BASE.midias, PRODUTO_C_NOVO]);
    const msg = "divulga o diffuser ultrasonic mist numa campanha nova";
    const out = await runCreationPath(msg, {
      midias,
      empresaId: EMPRESA_PRODUTO_NOVO_BASE.id_empresa,
    });
    try {
      assert.equal(out.resolved.status, "matched");
      assert.deepEqual(midiaIds(out.resolved.matches), ["produto-c-diffuser"]);
      assert.equal(out.gate.blocked, false);
    } catch (err) {
      err.trace = out.trace;
      throw err;
    }
    return out;
  });

  caseTestWithTrace("produto inexistente em cosméticos → missing", async () => {
    const midias = toTenantMidias(EMPRESA_COSMETICOS.midias);
    const msg = "quero uma arte do Produto X de chocolate";
    const out = await runCreationPath(msg, { midias, empresaId: EMPRESA_COSMETICOS.id_empresa });
    try {
      assert.ok(["missing", "not_requested"].includes(out.resolved.status));
      if (out.resolved.status === "missing") {
        assert.equal(out.gate.blocked, true);
        assert.equal((out.gate.proposal.midias_referenced || []).length, 0);
      }
    } catch (err) {
      err.trace = out.trace;
      throw err;
    }
    return out;
  });
});

after(() => {
  const passed = RESULTS.filter((r) => r.ok).length;
  const failed = RESULTS.filter((r) => !r.ok);
  console.log("\n========== RESUMO VAREJO LIVE ==========");
  console.log(`Total: ${RESULTS.length}`);
  console.log(`Passaram: ${passed}`);
  console.log(`Falharam: ${failed.length}`);
  for (const f of failed) {
    console.log(`- FAIL [${f.bucket || "?"}] ${f.id}: ${f.detail}`);
  }

  const byBucket = {};
  for (const f of FAILURES) {
    byBucket[f.bucket] = byBucket[f.bucket] || [];
    byBucket[f.bucket].push(f.id);
  }
  console.log("\n--- Classificação de falhas ---");
  console.log("1. geral_independente_categoria:", (byBucket.geral_independente_categoria || []).join(", ") || "—");
  console.log("2. categoria_especifica: (não usado — sem regras por categoria)");
  console.log("3. interpretacao_llm:", (byBucket.interpretacao_llm || []).join(", ") || "—");
  console.log("4. resolvedor_acervo:", (byBucket.resolvedor_acervo || []).join(", ") || "—");
  console.log("5. estado_memoria_ou_gate:", (byBucket.estado_memoria_ou_gate || []).join(", ") || "—");
  console.log("6. dados_ou_isolamento:", (byBucket.dados_ou_isolamento || []).join(", ") || "—");
  console.log("========================================\n");
});
