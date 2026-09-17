/**
 * Bateria da camada LLM de interpretação (sem gerar imagem).
 *
 * - Sempre: schema, validação anti-invenção, apply determinístico, fallback, observabilidade.
 * - completeFn injetado: simula saída estruturada do LLM (não ensina frases ao modelo).
 * - Live (opcional): CHAT_CREATION_LLM_INTERPRET_LIVE=true + LLM disponível.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  buildCreationInterpretPrompt,
  validateInterpretationAgainstMessage,
  llmInterpretToCreationTurn,
  interpretCreationMessage,
  parseCreationLlmInterpret,
  isCreationLlmInterpretEnabled,
} from "../../backend/src/services/creationLlmInterpret.js";
import { emptyCreationState } from "../../backend/src/services/chatCreationInterpret.js";

/** @type {{ id: string, ok: boolean, detail?: string }[]} */
const RESULTS = [];

/**
 * @param {string} id
 * @param {() => Promise<void> | void} fn
 */
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

/**
 * Simula LLM: devolve JSON estruturado (interpretação), sem casar frase no código de produção.
 * @param {Record<string, unknown>} payload
 */
function fakeLlm(payload) {
  return async () => JSON.stringify(payload);
}

function logTrace(id, trace) {
  console.log(`\n[LLM-INTERPRET ${id}]`);
  console.log("  mensagem:", trace.message);
  console.log("  source:", trace.source);
  console.log("  llm:", JSON.stringify(trace.llm_interpretation));
  console.log("  operação sugerida:", JSON.stringify(trace.suggested_operation));
  console.log("  validação:", JSON.stringify(trace.validation));
  console.log("  estado antes:", JSON.stringify(trace.state_before));
  console.log("  estado depois:", JSON.stringify(trace.state_after));
  console.log(
    "  arte_brief:",
    JSON.stringify({
      tema: trace.arte_brief?.tema,
      texto: trace.arte_brief?.texto,
      estilo: trace.arte_brief?.estilo,
    }),
  );
}

describe("LLM interpretação — schema e anti-invenção", () => {
  caseTest("L01 schema válido mínimo", () => {
    const r = parseCreationLlmInterpret({
      entities: { produto: "whey", cenario: "praia", oferta: "79,90" },
      suggested_operation: { type: "set", fields: ["produto", "cenario", "oferta"] },
    });
    assert.equal(r.ok, true);
  });

  caseTest("L02 rejeita tipo de operação inválido", () => {
    const r = parseCreationLlmInterpret({
      entities: {},
      suggested_operation: { type: "hack_state" },
    });
    assert.equal(r.ok, false);
  });

  caseTest("L03 anti-invenção: preço sem número na mensagem", () => {
    const data = parseCreationLlmInterpret({
      entities: { oferta: "R$199,90" },
      suggested_operation: { type: "patch", fields: ["oferta"] },
    }).data;
    const gate = validateInterpretationAgainstMessage("faz mais bonito", data);
    assert.equal(gate.ok, false);
  });

  caseTest("L04 anti-invenção: produto não mencionado", () => {
    const data = parseCreationLlmInterpret({
      entities: { produto: "creatina mega" },
      suggested_operation: { type: "set" },
    }).data;
    const gate = validateInterpretationAgainstMessage("quero algo na praia", data);
    assert.equal(gate.ok, false);
  });

  caseTest("L05 prompt descreve modelo de dados, não frases prontas", () => {
    const prompt = buildCreationInterpretPrompt({
      message: "teste",
      prevState: emptyCreationState(),
      historyTail: [],
    });
    assert.match(prompt, /SCHEMA JSON/i);
    assert.match(prompt, /REGRAS SEMÂNTICAS/i);
    assert.doesNotMatch(prompt, /cara de foto de verdade/i);
    assert.doesNotMatch(prompt, /latinha azul/i);
    assert.doesNotMatch(prompt, /malha[cç][aã]o/i);
  });
});

describe("LLM interpretação — apply determinístico (fixtures frágeis)", () => {
  caseTest("L10 cara de foto de verdade → estilo fotográfico", async () => {
    const msg = "Deixa com cara de foto de verdade.";
    const out = await interpretCreationMessage({
      message: msg,
      prevState: { ...emptyCreationState(), produto: "whey", oferta: "R$79,90" },
      completeFn: fakeLlm({
        entities: {
          produto: null,
          estilo: ["photorealistic", "fotografia real"],
          oferta: null,
        },
        suggested_operation: {
          type: "patch",
          fields: ["estilo"],
          interpretation_note: "usuário pede aparência fotográfica realista",
        },
        needs_product_clarification: false,
      }),
    });
    logTrace("L10", out.trace);
    assert.equal(out.trace.source, "llm");
    assert.match(out.state.estilo || "", /photo|foto|realista/i);
    assert.match(out.state.produto, /whey/i);
    assert.match(out.state.oferta, /79/);
  });

  caseTest("L11 anúncio revista americana anos 90 → estilo editorial/época", async () => {
    const msg = "Quero cara de anúncio de revista americana dos anos 90.";
    const out = await interpretCreationMessage({
      message: msg,
      prevState: { ...emptyCreationState(), produto: "whey" },
      completeFn: fakeLlm({
        entities: {
          estilo: ["editorial", "revista americana anos 90", "print ad"],
        },
        suggested_operation: {
          type: "patch",
          fields: ["estilo"],
          interpretation_note: "direção estética de anúncio editorial retrô",
        },
      }),
    });
    logTrace("L11", out.trace);
    assert.equal(out.trace.source, "llm");
    assert.match(out.state.estilo || "", /editorial|revista|90/i);
    assert.match(out.state.produto, /whey/i);
  });

  caseTest("L12 malhação → cenário academia", async () => {
    const msg = "Põe o whey na malhação.";
    const out = await interpretCreationMessage({
      message: msg,
      completeFn: fakeLlm({
        entities: { produto: "whey", cenario: "malhação" },
        suggested_operation: { type: "set", fields: ["produto", "cenario"] },
      }),
    });
    logTrace("L12", out.trace);
    assert.equal(out.state.cenario, "academia");
    assert.match(out.state.produto, /whey/i);
  });

  caseTest("L13 beach → praia", async () => {
    const msg = "Put this whey on the beach with 79,90.";
    const out = await interpretCreationMessage({
      message: msg,
      completeFn: fakeLlm({
        entities: { produto: "whey", cenario: "beach", oferta: "79,90" },
        suggested_operation: { type: "set", fields: ["produto", "cenario", "oferta"] },
      }),
    });
    logTrace("L13", out.trace);
    assert.equal(out.state.cenario, "praia");
    assert.match(out.state.oferta, /79/);
  });

  caseTest("L14 aquele da latinha azul → clarification + referência", async () => {
    const msg = "Usa aquele da latinha azul.";
    const out = await interpretCreationMessage({
      message: msg,
      completeFn: fakeLlm({
        entities: {
          produto: null,
          produto_referencia: "latinha azul",
        },
        suggested_operation: {
          type: "clarify_product",
          fields: ["produto"],
          interpretation_note: "referência descritiva; código deve resolver no acervo",
        },
        needs_product_clarification: true,
      }),
    });
    logTrace("L14", out.trace);
    assert.equal(out.turn.needsProductClarification, true);
    assert.equal(out.state.produto, "");
    assert.equal(out.turn.produto_referencia, "latinha azul");
  });

  caseTest("L15 melhor na praia → patch só cenário", async () => {
    const prev = {
      ...emptyCreationState(),
      produto: "whey",
      cenario: "academia",
      oferta: "R$79,90",
    };
    const msg = "Melhor na praia.";
    const out = await interpretCreationMessage({
      message: msg,
      prevState: prev,
      completeFn: fakeLlm({
        entities: { cenario: "praia" },
        suggested_operation: {
          type: "patch",
          fields: ["cenario"],
          interpretation_note: "parece preferir trocar o cenário",
        },
      }),
    });
    logTrace("L15", out.trace);
    assert.equal(out.state.cenario, "praia");
    assert.match(out.state.produto, /whey/i);
    assert.match(out.state.oferta, /79/);
  });

  caseTest("L16 preço lá em cima → destaque", async () => {
    const msg = "Coloca o preço lá em cima — 79,90.";
    const out = await interpretCreationMessage({
      message: msg,
      prevState: { ...emptyCreationState(), produto: "whey" },
      completeFn: fakeLlm({
        entities: { oferta: "79,90", destaque: "preço no topo" },
        suggested_operation: { type: "patch", fields: ["oferta", "destaque"] },
      }),
    });
    logTrace("L16", out.trace);
    assert.match(out.state.oferta, /79/);
    assert.match(out.state.destaque || "", /pre[cç]o|topo|cima/i);
  });

  caseTest("L17 faz mais chamativo → estilo/destaque sem apagar", async () => {
    const prev = {
      ...emptyCreationState(),
      produto: "whey",
      cenario: "academia",
      oferta: "R$79,90",
    };
    const out = await interpretCreationMessage({
      message: "Faz mais chamativo.",
      prevState: prev,
      completeFn: fakeLlm({
        entities: { estilo: ["chamativo"], destaque: "oferta em evidência" },
        suggested_operation: { type: "patch", fields: ["estilo", "destaque"] },
      }),
    });
    logTrace("L17", out.trace);
    assert.match(out.state.estilo || "", /chamativ/i);
    assert.match(out.state.produto, /whey/i);
    assert.match(out.state.oferta, /79/);
  });

  caseTest("L18 troca esse pelo outro → clarify (ambíguo)", async () => {
    const out = await interpretCreationMessage({
      message: "Troca esse pelo outro.",
      prevState: { ...emptyCreationState(), produto: "whey" },
      completeFn: fakeLlm({
        entities: { produto: null, produto_referencia: "o outro" },
        suggested_operation: {
          type: "clarify_product",
          fields: ["produto"],
          interpretation_note: "usuário parece querer substituir o produto atual",
        },
        needs_product_clarification: true,
        ambiguities: ["produto destino não nomeado"],
      }),
    });
    logTrace("L18", out.trace);
    assert.equal(out.turn.needsProductClarification, true);
    // Código preserva whey até resolução segura.
    assert.match(out.state.produto, /whey/i);
  });

  caseTest("L19 contexto multi-mensagem + frase nova", async () => {
    const history = [
      { role: "user", content: "Quero uma arte desse whey na academia." },
      { role: "assistant", content: "Beleza — whey · cenário academia." },
    ];
    const prev = {
      ...emptyCreationState(),
      produto: "whey",
      cenario: "academia",
    };
    const msg = "Agora com vibe sunset e 69,90 bem alto.";
    const out = await interpretCreationMessage({
      message: msg,
      prevState: prev,
      history,
      completeFn: fakeLlm({
        entities: {
          oferta: "69,90",
          estilo: ["sunset", "warm"],
          destaque: "preço bem alto",
        },
        suggested_operation: {
          type: "patch",
          fields: ["oferta", "estilo", "destaque"],
          interpretation_note: "acrescenta preço e mood sunset ao briefing existente",
        },
      }),
    });
    logTrace("L19", out.trace);
    assert.match(out.state.produto, /whey/i);
    assert.equal(out.state.cenario, "academia");
    assert.match(out.state.oferta, /69/);
    assert.match(out.state.estilo || "", /sunset|warm/i);
    assert.match(String(out.trace.arte_brief?.texto || out.trace.arte_brief?.tema || ""), /69/);
  });

  caseTest("L20 frase composta inédita", async () => {
    const msg =
      "Faz esse whey na praia, coloca 79,90 bem grande e deixa com cara de foto profissional.";
    const out = await interpretCreationMessage({
      message: msg,
      completeFn: fakeLlm({
        entities: {
          produto: "whey",
          cenario: "praia",
          oferta: "79.90",
          destaque: "preço",
          estilo: ["fotografia profissional", "photorealistic"],
        },
        suggested_operation: {
          type: "set",
          fields: ["produto", "cenario", "oferta", "destaque", "estilo"],
        },
      }),
    });
    logTrace("L20", out.trace);
    assert.equal(out.state.cenario, "praia");
    assert.match(out.state.produto, /whey/i);
    assert.match(out.state.oferta, /79/);
    assert.match(out.state.estilo || "", /foto|photo|profissional/i);
  });
});

describe("LLM interpretação — fallback determinístico", () => {
  caseTest("L30 LLM indisponível → deterministic", async () => {
    const out = await interpretCreationMessage({
      message: "Quero esse whey na academia por R$ 79,90.",
      completeFn: async () => {
        throw new Error("llm down");
      },
    });
    logTrace("L30", out.trace);
    assert.equal(out.trace.source, "deterministic");
    assert.match(out.state.produto, /whey/i);
    assert.equal(out.state.cenario, "academia");
    assert.match(out.state.oferta, /79/);
  });

  caseTest("L31 forceDeterministic ignora LLM", async () => {
    const out = await interpretCreationMessage({
      message: "Faz uma promoção desse whey por R$ 79,90.",
      forceDeterministic: true,
      completeFn: fakeLlm({
        entities: { produto: "inventado" },
        suggested_operation: { type: "set" },
      }),
    });
    assert.equal(out.trace.source, "deterministic");
    assert.match(out.state.produto, /whey/i);
  });

  caseTest("L32 validação falha → fallback", async () => {
    const out = await interpretCreationMessage({
      message: "Quero esse whey na academia.",
      completeFn: fakeLlm({
        entities: { produto: "creatina fantasma", oferta: "999,99" },
        suggested_operation: { type: "set" },
      }),
    });
    logTrace("L32", out.trace);
    assert.equal(out.trace.source, "deterministic");
    assert.match(out.state.produto, /whey/i);
    assert.equal(out.state.cenario, "academia");
  });

  caseTest("L33 LLM não altera estado diretamente (merge só via código)", async () => {
    const prev = emptyCreationState();
    const data = parseCreationLlmInterpret({
      entities: { produto: "whey", cenario: "praia", oferta: "50,00" },
      suggested_operation: { type: "set" },
    }).data;
    // Estado prévio intacto até merge.
    assert.equal(prev.produto, "");
    const turn = llmInterpretToCreationTurn(data, "whey na praia 50,00");
    assert.equal(prev.produto, "");
    assert.match(turn.productQuery || "", /whey/i);
  });
});

describe("LLM interpretação — live (opcional)", () => {
  const live = String(process.env.CHAT_CREATION_LLM_INTERPRET_LIVE || "")
    .trim()
    .toLowerCase();
  const runLive = live === "1" || live === "true" || live === "yes";

  it("L40 live Ollama: frase inédita (skip sem LIVE)", async (t) => {
    if (!runLive) {
      t.skip("defina CHAT_CREATION_LLM_INTERPRET_LIVE=true para rodar contra Ollama");
      return;
    }
    if (!isCreationLlmInterpretEnabled()) {
      t.skip("CHAT_CREATION_LLM_INTERPRET=true necessário para live");
      return;
    }
    const msg =
      "Monta o whey num clima meio dusk na orla, com 84,50 bem legível, sem cara de template.";
    const out = await interpretCreationMessage({ message: msg });
    logTrace("L40-live-ollama", out.trace);
    assert.ok(out.trace.source === "llm" || out.trace.source === "deterministic");
    if (out.trace.source === "llm") {
      assert.match(out.state.produto || "", /whey/i);
      assert.ok(out.state.oferta || out.state.cenario || out.state.estilo);
    }
  });
});

after(() => {
  const passed = RESULTS.filter((r) => r.ok).length;
  const failed = RESULTS.filter((r) => !r.ok);
  console.log("\n========== RESUMO BATERIA LLM INTERPRETAÇÃO ==========");
  console.log(`Total de testes (rastreáveis): ${RESULTS.length}`);
  console.log(`Passaram: ${passed}`);
  console.log(`Falharam: ${failed.length}`);
  if (failed.length) {
    for (const f of failed) {
      console.log(`- ${f.id}: ${f.detail}`);
    }
  }
  console.log("======================================================\n");
});
