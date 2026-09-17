/**
 * Bateria de ESTRESSE conversacional pré-feira (Llama).
 * Objetivo: achar interpretação absurda / falha de diálogo — NÃO corrigir aqui.
 *
 * Trace por turno: mensagem → interpretação → operação → estado → candidato → acervo → briefing → resposta
 *
 * Requer: CHAT_CREATION_LLM_INTERPRET=true + CHAT_CREATION_LLM_PROVIDER=ollama
 * Rode: node --test testes/backend/creation-conversational-stress-live.test.js
 *
 * Opcional: STRESS_QUICK=1 (amostra menor)
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { interpretCreationMessage, isCreationLlmInterpretEnabled } from "../../backend/src/services/creationLlmInterpret.js";
import {
  emptyCreationState,
  formatCreationBriefAck,
} from "../../backend/src/services/chatCreationInterpret.js";
import {
  applyProductMediaGate,
  buildCreationProductCandidate,
  resolveProductFromAcervo,
  toProductCandidate,
  isCreativeBriefingToken,
} from "../../backend/src/services/productAcervoResolve.js";
import { isCreationLlmOllama } from "../../backend/src/config.js";
import { buildArteBriefFromHistory } from "../../backend/src/services/rawImageArteBrief.js";
import {
  EMPRESA_ALIMENTOS,
  EMPRESA_AUTOMOTIVO,
  EMPRESA_CASA,
  EMPRESA_COSMETICOS,
  EMPRESA_ELETRONICOS,
  EMPRESA_PAPELARIA,
  EMPRESA_PET,
  EMPRESA_PRODUTO_NOVO_BASE,
  EMPRESA_ROUPAS,
  EMPRESA_SUPLEMENTOS,
  PRODUTO_C_NOVO,
  toTenantMidias,
} from "./fixtures/acervo-varejo-multiempresa.fixture.js";

const QUICK = String(process.env.STRESS_QUICK || "").trim() === "1";

/** @type {{ id: string, ok: boolean, families: string[], detail?: string, trace?: unknown }[]} */
const RESULTS = [];

/** @type {{ id: string, families: string[], detail: string, trace?: unknown }[]} */
const FAILURES = [];

const CREATIVE_POLLUTION = [
  "espaco",
  "chamada",
  "lancamento",
  "moderno",
  "premium",
  "bonito",
  "massa",
  "top",
  "chique",
  "verao",
  "inverno",
  "propaganda",
  "minimalista",
  "chamativo",
];

/** Âncoras multicategoria — só dados de fixture, sem regra de negócio. */
const ANCHORS = [
  {
    key: "suplementos",
    empresa: EMPRESA_SUPLEMENTOS,
    nome: "pro force morango",
    expectId: "pf-morango",
    attrMsg: "creatina limão",
    attrId: "creatina-limao",
  },
  {
    key: "roupas",
    empresa: EMPRESA_ROUPAS,
    nome: "camiseta preta",
    expectId: "camiseta-preta",
    attrMsg: "tênis branco 42",
    attrId: "tenis-branco-42",
  },
  {
    key: "cosmeticos",
    empresa: EMPRESA_COSMETICOS,
    nome: "perfume floral 100ml",
    expectId: "perfume-100ml",
    attrMsg: "hidratante rose",
    attrId: "hidratante-rose",
    ambiguousMsg: "perfume floral",
  },
  {
    key: "eletronicos",
    empresa: EMPRESA_ELETRONICOS,
    nome: "fone bluetooth",
    expectId: "fone-bluetooth",
    attrMsg: "celular azul",
    attrId: "celular-azul",
  },
  {
    key: "alimentos",
    empresa: EMPRESA_ALIMENTOS,
    nome: "café torrado",
    expectId: "cafe-torrado",
    attrMsg: "suco laranja 1l",
    attrId: "suco-laranja-1l",
  },
  {
    key: "pet",
    empresa: EMPRESA_PET,
    nome: "ração cão adulto",
    expectId: "racao-cao-adulto",
    attrMsg: "brinquedo osso",
    attrId: "brinquedo-osso",
  },
  {
    key: "casa",
    empresa: EMPRESA_CASA,
    nome: "sofá 3 lugares",
    expectId: "sofa-3-lugares",
    attrMsg: "luminária de mesa",
    attrId: "luminaria-mesa",
  },
  {
    key: "automotivo",
    empresa: EMPRESA_AUTOMOTIVO,
    nome: "pneu aro 16",
    expectId: "pneu-aro-16",
    attrMsg: "capa de banco",
    attrId: "capa-banco",
  },
  {
    key: "papelaria",
    empresa: EMPRESA_PAPELARIA,
    nome: "caderno universitario",
    expectId: "caderno-universitario",
    attrMsg: "caneta gel azul",
    attrId: "caneta-gel-azul",
  },
];

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
      cenario: llm.cenario ?? null,
      tema: llm.tema ?? null,
      oferta: llm.oferta ?? null,
      estilo: Array.isArray(llm.estilo) ? llm.estilo : [],
      destaque: llm.destaque ?? null,
      formato: llm.formato ?? null,
      intencao: llm.intencao ?? null,
    };
  }
  const st = out?.state || emptyCreationState();
  return {
    produto: st.produto || null,
    produto_referencia: null,
    sabor: st.sabor || null,
    atributos: st.sabor ? [st.sabor] : [],
    cenario: st.cenario || null,
    tema: st.tema || null,
    oferta: st.oferta || null,
    estilo: st.estilo ? [st.estilo] : [],
    destaque: st.destaque || null,
    formato: out?.turn?.formato_hint || null,
    intencao: st.intencao || null,
  };
}

function buildReply(interpret, resolved, gate) {
  if (gate?.blocked && gate.confirmation_message) return String(gate.confirmation_message);
  if (resolved?.ask) return String(resolved.ask);
  if (interpret?.turn?.needsProductClarification) {
    return "Qual produto do acervo você quer na arte?";
  }
  const label =
    resolved?.status === "matched"
      ? String(resolved.matches?.[0]?.nome_exibicao || "")
      : "";
  return formatCreationBriefAck(interpret.state, label);
}

/**
 * @param {string} message
 * @param {{
 *   midias: ReturnType<typeof toTenantMidias>,
 *   prevState?: object,
 *   history?: Array<{role:string,content:string}>,
 *   empresaId?: string,
 *   uiFormat?: string | null,
 * }} opts
 */
async function runTurn(message, opts) {
  const midias = opts.midias;
  const history = Array.isArray(opts.history) ? opts.history : [];
  const prevState = opts.prevState || emptyCreationState();
  const stateBefore = { ...prevState };

  const interpret = await interpretCreationMessage({
    message,
    prevState,
    history,
  });

  const entities = entitiesFromInterpret(interpret);
  // Estado mesclado é fonte de verdade do produto no follow-up.
  if (!entities.produto && interpret.state?.produto) {
    entities.produto = interpret.state.produto;
  }
  const candidate = buildCreationProductCandidate({
    entities,
    message,
    midiaRows: midias,
    stateProduto: interpret.state?.produto || prevState?.produto || null,
  });
  const fromEntities = toProductCandidate(entities, { acervoRows: midias });
  const resolved = resolveProductFromAcervo(candidate, midias);
  const histForGate = [...history, { role: "user", content: message }];
  const gate = applyProductMediaGate({}, midias, message, histForGate, { entities });
  const arteBrief = buildArteBriefFromHistory(histForGate, []);
  const reply = buildReply(interpret, resolved, gate);

  const operation =
    interpret.turn?.operation ||
    interpret.trace?.suggested_operation ||
    interpret.trace?.llm_interpretation?.suggested_operation ||
    null;

  const trace = {
    empresa: opts.empresaId || null,
    message,
    ui_format: opts.uiFormat ?? null,
    interpretation: {
      source: interpret.trace?.source,
      entities,
      needs_product_clarification: Boolean(interpret.turn?.needsProductClarification),
      ambiguities: interpret.trace?.llm_interpretation?.ambiguities || [],
      formato_hint: interpret.turn?.formato_hint || entities.formato || null,
    },
    operation,
    state_before: stateBefore,
    state_after: { ...interpret.state },
    candidate_from_entities: fromEntities,
    candidate_effective: candidate,
    resolve: {
      status: resolved.status,
      ids: midiaIds(resolved.matches),
      ask: resolved.ask || null,
    },
    gate: {
      status: gate.proposal?.product_media_status,
      blocked: gate.blocked,
      ids: (gate.proposal?.midias_referenced || []).map((m) => m.id_midia).sort(),
      ask: gate.confirmation_message || null,
    },
    briefing: {
      intencao: interpret.state?.intencao || "",
      estilo: interpret.state?.estilo || "",
      oferta: interpret.state?.oferta || "",
      cenario: interpret.state?.cenario || "",
      tema: interpret.state?.tema || "",
      destaque: interpret.state?.destaque || "",
      formato_arte_brief: arteBrief?.formato?.ratio || arteBrief?.formato?.preset_id || null,
    },
    resposta: reply,
  };

  return { interpret, entities, candidate, resolved, gate, reply, trace, midias };
}

function candidateLooksCreativeOnly(candidate) {
  const nome = String(candidate?.nome || "").toLowerCase();
  if (!nome) return false;
  const toks = nome.split(/\s+/).filter(Boolean);
  return toks.length > 0 && toks.every((t) => isCreativeBriefingToken(t) || CREATIVE_POLLUTION.includes(t));
}

/**
 * Classifica falha conversacional (taxonomia do pedido).
 * @param {string} detail
 * @param {unknown} trace
 */
function classifyFailureFamilies(detail, trace) {
  const d = String(detail || "").toLowerCase();
  const families = [];
  const push = (f) => {
    if (!families.includes(f)) families.push(f);
  };

  if (/produto errado|wrong product|expectid|resolve_ids|trocou produto|produto contamin/i.test(d)) {
    push("produto errado");
  }
  if (/atributo/i.test(d)) push("atributo errado");
  if (/inten[cç][aã]o/i.test(d)) push("intenção errada");
  if (/estilo/i.test(d)) push("estilo errado");
  if (/cen[aá]rio/i.test(d)) push("cenário errado");
  if (/pre[cç]o|oferta|59|79|69/i.test(d) && /errada|sumiu|perdeu|invent/i.test(d)) {
    push("preço errado");
  }
  if (/formato|story|16:9|quadrado|horizontal/i.test(d)) push("formato errado");
  if (/contexto|preserv|perda|esquec|antes/i.test(d)) push("perda de contexto");
  if (/destrut|apagou|wipe|zerou/i.test(d)) push("alteração destrutiva");
  if (/pergunta desnecess/i.test(d)) push("pergunta desnecessária");
  if (/falta de pergunta|deveria pergunt/i.test(d)) push("falta de pergunta");
  if (/inven|inventou|alucin/i.test(d)) push("invenção");
  if (/m[ií]dia errada|gate_ids|midia/i.test(d)) push("mídia errada");
  if (/resposta|ack|textual/i.test(d)) push("resposta textual incoerente");
  if (/falsa confirma|afirmou|gerou|encontrei/i.test(d)) push("falsa confirmação");
  if (/absurda|criativo como produto|pollut/i.test(d)) push("invenção");
  if (!families.length) push("outra");
  return families;
}

function fail(id, detail, trace) {
  const err = new Error(detail);
  err.trace = trace;
  err.caseId = id;
  throw err;
}

function caseTest(id, fn) {
  it(id, async () => {
    let lastTrace;
    try {
      const out = await fn((trace) => {
        lastTrace = trace;
      });
      if (out?.trace) lastTrace = out.trace;
      RESULTS.push({ id, ok: true, families: [] });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const trace = err?.trace || lastTrace;
      const families = classifyFailureFamilies(detail, trace);
      RESULTS.push({ id, ok: false, families, detail, trace });
      FAILURES.push({ id, families, detail, trace });
      throw err;
    }
  });
}

function logTrace(trace) {
  if (QUICK) return;
  const compact = {
    msg: trace.message,
    src: trace.interpretation?.source,
    op: trace.operation?.type || trace.operation?.suggested_operation?.type,
    prod: trace.state_after?.produto,
    oferta: trace.state_after?.oferta,
    resolve: trace.resolve?.status,
    ids: trace.resolve?.ids,
    reply: String(trace.resposta || "").slice(0, 120),
  };
  console.log(`[STRESS] ${JSON.stringify(compact)}`);
}

/** Assert helpers — marcam a família no detalhe. */
function assertNoInventedMedia(trace, midias) {
  for (const id of trace.resolve?.ids || []) {
    if (!midias.some((m) => m.id_midia === id)) {
      fail("x", `invenção/mídia errada: id ${id} fora do tenant`, trace);
    }
  }
  for (const id of trace.gate?.ids || []) {
    if (!midias.some((m) => m.id_midia === id)) {
      fail("x", `invenção/mídia errada no gate: ${id}`, trace);
    }
  }
}

function assertNoCreativeAsProduct(trace) {
  if (candidateLooksCreativeOnly(trace.candidate_effective)) {
    fail("x", `interpretação absurda: criativo como produto («${trace.candidate_effective.nome}»)`, trace);
  }
  const nome = String(trace.candidate_effective?.nome || "").toLowerCase();
  for (const bad of CREATIVE_POLLUTION) {
    if (nome === bad) {
      fail("x", `interpretação absurda: token criativo «${bad}» virou produto`, trace);
    }
  }
}

function assertReplyDoesNotClaimGeneration(trace) {
  const r = String(trace.resposta || "").toLowerCase();
  if (/\b(gerei|já gerei|imagem pronta|arte pronta|publiquei)\b/.test(r)) {
    fail("x", "falsa confirmação/resposta textual: afirmou geração real", trace);
  }
  if (
    trace.resolve?.status === "missing" &&
    /\b(encontrei o produto|usei a mídia|produto encontrado)\b/.test(r)
  ) {
    fail("x", "falsa confirmação: afirmou produto/mídia sem resolução", trace);
  }
}

// ─── definição dos casos ───────────────────────────────────────────

function buildCases() {
  /** @type {Array<{ id: string, group: string, run: (setTrace:(t:any)=>void)=>Promise<any> }>} */
  const cases = [];

  const pickAnchors = QUICK ? ANCHORS.slice(0, 3) : ANCHORS;

  // 1) Linguagem extremamente curta (sem produto no contexto)
  for (const msg of QUICK
    ? ["faz uma arte disso", "manda ver", "quero vender"]
    : ["faz uma arte disso", "divulga esse", "quero vender", "faz um post", "faz bonito", "manda ver"]) {
    cases.push({
      id: `1-curta:${msg}`,
      group: "1-curta",
      run: async (setTrace) => {
        const midias = toTenantMidias(EMPRESA_ROUPAS.midias);
        const out = await runTurn(msg, { midias, empresaId: EMPRESA_ROUPAS.id_empresa });
        setTrace(out.trace);
        logTrace(out.trace);
        assertNoCreativeAsProduct(out.trace);
        assertNoInventedMedia(out.trace, midias);
        assertReplyDoesNotClaimGeneration(out.trace);
        // Sem produto: não pode matchar mídia arbitrariamente.
        if (out.resolved.status === "matched") {
          fail(msg, "falta de pergunta / invenção: curta sem produto matchou mídia", out.trace);
        }
        return out;
      },
    });
  }

  // 2) Informal COM produto prévio
  {
    const midias = toTenantMidias(EMPRESA_COSMETICOS.midias);
    const informal = QUICK
      ? ["deixa top", "faz mais chique"]
      : ["faz uma parada massa", "deixa top", "bota ele grandão", "faz mais chique", "mete um fundo bonito", "deixa com cara de propaganda"];
    for (const msg of informal) {
      cases.push({
        id: `2-informal:${msg}`,
        group: "2-informal",
        run: async (setTrace) => {
          const t1 = await runTurn("faz uma arte do perfume floral 100ml", {
            midias,
            empresaId: EMPRESA_COSMETICOS.id_empresa,
          });
          const t2 = await runTurn(msg, {
            midias,
            empresaId: EMPRESA_COSMETICOS.id_empresa,
            prevState: t1.interpret.state,
            history: [{ role: "user", content: "faz uma arte do perfume floral 100ml" }],
          });
          setTrace(t2.trace);
          logTrace(t2.trace);
          assertNoCreativeAsProduct(t2.trace);
          assertNoInventedMedia(t2.trace, midias);
          if (t2.resolved.status === "matched" && !midiaIds(t2.resolved.matches).includes("perfume-100ml")) {
            fail(msg, "produto errado / perda de contexto no informal", t2.trace);
          }
          if (!t2.interpret.state.produto && t1.interpret.state.produto) {
            fail(msg, "perda de contexto: informal apagou produto", t2.trace);
          }
          return t2;
        },
      });
    }
  }

  // 3) Typos + produto
  for (const msg of QUICK
    ? ["faz divulgaçao do cafe torrado", "promoçao do chocolate ao leite"]
    : [
        "faz divulgaçao do cafe torrado",
        "quero promoçao do chocolate ao leite",
        "arte do prooduto cafe torrado",
        "profissional: arte do suco laranja 1l",
      ]) {
    cases.push({
      id: `3-typo:${msg.slice(0, 40)}`,
      group: "3-typo",
      run: async (setTrace) => {
        const midias = toTenantMidias(EMPRESA_ALIMENTOS.midias);
        const out = await runTurn(msg, { midias, empresaId: EMPRESA_ALIMENTOS.id_empresa });
        setTrace(out.trace);
        logTrace(out.trace);
        assertNoCreativeAsProduct(out.trace);
        assertNoInventedMedia(out.trace, midias);
        assertReplyDoesNotClaimGeneration(out.trace);
        return out;
      },
    });
  }

  // 4) Mensagens quebradas (multi-turno)
  cases.push({
    id: "4-quebrada:quero→arte→produto→preço→premium",
    group: "4-quebrada",
    run: async (setTrace) => {
      const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
      const steps = ["quero", "uma arte", "desse fone bluetooth", "com preço", "59,90", "mais premium"];
      let state = emptyCreationState();
      let history = [];
      let last;
      for (const msg of steps) {
        last = await runTurn(msg, {
          midias,
          empresaId: EMPRESA_ELETRONICOS.id_empresa,
          prevState: state,
          history,
        });
        state = last.interpret.state;
        history = [...history, { role: "user", content: msg }];
        logTrace(last.trace);
      }
      setTrace(last.trace);
      assertNoInventedMedia(last.trace, midias);
      if (last.resolved.status === "matched") {
        assert.deepEqual(midiaIds(last.resolved.matches), ["fone-bluetooth"]);
      } else if (!/fone|bluetooth/i.test(String(last.interpret.state.produto || ""))) {
        fail("4", "perda de contexto: produto não acumulou nas mensagens quebradas", last.trace);
      }
      if (last.interpret.state.oferta && !/59/.test(String(last.interpret.state.oferta))) {
        fail("4", "preço errado após mensagens quebradas", last.trace);
      }
      return last;
    },
  });

  // 5) Fora de ordem
  for (const spec of [
    {
      id: "5-ordem:59 loja moderno",
      empresa: EMPRESA_ROUPAS,
      msg: "59,90 essa camiseta preta numa loja faz moderno",
      expectId: "camiseta-preta",
    },
    {
      id: "5-ordem:moderno perfume",
      empresa: EMPRESA_COSMETICOS,
      msg: "moderno, 59,90, usa aquele perfume floral 100ml",
      expectId: "perfume-100ml",
    },
    {
      id: "5-ordem:escritorio notebook",
      empresa: EMPRESA_ELETRONICOS,
      msg: "coloca o notebook 14 no escritório e faz uma divulgação dele",
      expectId: "notebook-14",
    },
  ]) {
    cases.push({
      id: spec.id,
      group: "5-ordem",
      run: async (setTrace) => {
        const midias = toTenantMidias(spec.empresa.midias);
        const out = await runTurn(spec.msg, { midias, empresaId: spec.empresa.id_empresa });
        setTrace(out.trace);
        logTrace(out.trace);
        assertNoCreativeAsProduct(out.trace);
        assertNoInventedMedia(out.trace, midias);
        if (out.resolved.status === "matched") {
          assert.deepEqual(midiaIds(out.resolved.matches), [spec.expectId]);
        } else {
          fail(spec.id, `produto errado/falta: esperado ${spec.expectId}, status=${out.resolved.status}`, out.trace);
        }
        return out;
      },
    });
  }

  // 6) Mudança de ideia
  cases.push({
    id: "6-mudanca:perfume→outro→preço→minimalista",
    group: "6-mudanca",
    run: async (setTrace) => {
      const midias = toTenantMidias(EMPRESA_COSMETICOS.midias);
      const steps = [
        "faz uma arte do perfume floral 100ml",
        "coloca num ambiente elegante",
        "79,90",
        "pensando bem, troca pelo hidratante rose",
        "melhor 69,90",
        "e deixa mais minimalista",
      ];
      let state = emptyCreationState();
      let history = [];
      let last;
      for (const msg of steps) {
        last = await runTurn(msg, {
          midias,
          empresaId: EMPRESA_COSMETICOS.id_empresa,
          prevState: state,
          history,
        });
        state = last.interpret.state;
        history = [...history, { role: "user", content: msg }];
        logTrace(last.trace);
      }
      setTrace(last.trace);
      assertNoInventedMedia(last.trace, midias);
      if (last.resolved.status === "matched") {
        if (!midiaIds(last.resolved.matches).includes("hidratante-rose")) {
          fail("6", "produto errado após troca de ideia", last.trace);
        }
      } else if (!/hidratante/i.test(String(last.interpret.state.produto || ""))) {
        fail("6", "perda de contexto: troca de produto não pegou", last.trace);
      }
      if (last.interpret.state.oferta && !/69/.test(String(last.interpret.state.oferta))) {
        fail("6", "preço errado: deveria refletir 69,90", last.trace);
      }
      return last;
    },
  });

  // 7) Alterações pontuais
  for (const msg of [
    "muda só o preço para 49,90",
    "troca apenas o fundo",
    "não mexe no produto",
    "mantém tudo e muda o estilo para clean",
  ]) {
    cases.push({
      id: `7-pontual:${msg.slice(0, 36)}`,
      group: "7-pontual",
      run: async (setTrace) => {
        const midias = toTenantMidias(EMPRESA_PET.midias);
        const t1 = await runTurn("faz um post da ração cão adulto", {
          midias,
          empresaId: EMPRESA_PET.id_empresa,
        });
        const t2 = await runTurn(msg, {
          midias,
          empresaId: EMPRESA_PET.id_empresa,
          prevState: t1.interpret.state,
          history: [{ role: "user", content: "faz um post da ração cão adulto" }],
        });
        setTrace(t2.trace);
        logTrace(t2.trace);
        assertNoInventedMedia(t2.trace, midias);
        if (
          t1.resolved.status === "matched" &&
          t2.resolved.status === "matched" &&
          midiaIds(t2.resolved.matches)[0] !== midiaIds(t1.resolved.matches)[0]
        ) {
          fail(msg, "alteração destrutiva/produto errado: pontual trocou mídia", t2.trace);
        }
        if (/não mexe no produto/i.test(msg) && t2.interpret.state.produto !== t1.interpret.state.produto) {
          // allow minor normalize
          if (
            !String(t2.interpret.state.produto || "").includes("racao") &&
            !String(t2.interpret.state.produto || "").includes("cão")
          ) {
            fail(msg, "alteração destrutiva: «não mexe no produto» alterou produto", t2.trace);
          }
        }
        return t2;
      },
    });
  }

  // 8) Referências vagas
  for (const msg of QUICK
    ? ["aquele", "o azul", "aquele que cadastrei agora"]
    : ["aquele", "o outro", "o azul", "o novo", "aquele que cadastrei agora", "o segundo", "esse aqui", "o de cima"]) {
    cases.push({
      id: `8-vaga:${msg}`,
      group: "8-vaga",
      run: async (setTrace) => {
        const midias = toTenantMidias(EMPRESA_ROUPAS.midias);
        const out = await runTurn(msg, { midias, empresaId: EMPRESA_ROUPAS.id_empresa });
        setTrace(out.trace);
        logTrace(out.trace);
        assertNoInventedMedia(out.trace, midias);
        assertReplyDoesNotClaimGeneration(out.trace);
        if (out.resolved.status === "matched") {
          fail(msg, "falta de pergunta / invenção: referência vaga matchou sem contexto", out.trace);
        }
        return out;
      },
    });
  }

  // 9) Atributos (multicategoria)
  for (const a of pickAnchors) {
    cases.push({
      id: `9-attr:${a.key}:${a.attrMsg}`,
      group: "9-attr",
      run: async (setTrace) => {
        const midias = toTenantMidias(a.empresa.midias);
        const out = await runTurn(`faz uma arte d${/^[aeiou]/i.test(a.attrMsg) ? "o" : "a"} ${a.attrMsg}`, {
          midias,
          empresaId: a.empresa.id_empresa,
        });
        setTrace(out.trace);
        logTrace(out.trace);
        assertNoCreativeAsProduct(out.trace);
        assertNoInventedMedia(out.trace, midias);
        if (out.resolved.status !== "matched" || !midiaIds(out.resolved.matches).includes(a.attrId)) {
          fail(a.attrMsg, `atributo/produto errado: esperado ${a.attrId}, veio ${out.resolved.status}:${midiaIds(out.resolved.matches)}`, out.trace);
        }
        return out;
      },
    });
  }

  // 10) Ambiguidade
  cases.push({
    id: "10-ambig:perfume floral",
    group: "10-ambig",
    run: async (setTrace) => {
      const midias = toTenantMidias(EMPRESA_COSMETICOS.midias);
      const out = await runTurn("faz uma arte do perfume floral", {
        midias,
        empresaId: EMPRESA_COSMETICOS.id_empresa,
      });
      setTrace(out.trace);
      logTrace(out.trace);
      if (out.resolved.status === "matched") {
        fail("10", "falta de pergunta: ambiguidade perfume escolheu arbitrariamente", out.trace);
      }
      if (out.resolved.status === "ambiguous") {
        assert.ok((out.resolved.matches || []).length >= 2);
        assert.match(String(out.resolved.ask || out.reply || ""), /qual|mais de um/i);
      }
      return out;
    },
  });

  // 11) Inexistente (multicategoria)
  for (const a of pickAnchors) {
    cases.push({
      id: `11-missing:${a.key}`,
      group: "11-missing",
      run: async (setTrace) => {
        const midias = toTenantMidias(a.empresa.midias);
        const out = await runTurn("quero uma arte do Produto X de chocolate", {
          midias,
          empresaId: a.empresa.id_empresa,
        });
        setTrace(out.trace);
        logTrace(out.trace);
        assertNoInventedMedia(out.trace, midias);
        assertReplyDoesNotClaimGeneration(out.trace);
        if (out.resolved.status === "matched" || (out.gate.ids || []).length) {
          fail(a.key, "invenção/mídia errada: produto inexistente matchou", out.trace);
        }
        return out;
      },
    });
  }

  // 12) Criatividade sem produto
  for (const msg of ["faz uma arte de verão", "quero uma campanha premium", "faz uma divulgação bonita"]) {
    for (const a of QUICK ? pickAnchors.slice(0, 2) : pickAnchors.slice(0, 4)) {
      cases.push({
        id: `12-criativo:${a.key}:${msg.slice(0, 24)}`,
        group: "12-criativo",
        run: async (setTrace) => {
          const midias = toTenantMidias(a.empresa.midias);
          const out = await runTurn(msg, { midias, empresaId: a.empresa.id_empresa });
          setTrace(out.trace);
          logTrace(out.trace);
          assertNoCreativeAsProduct(out.trace);
          assertNoInventedMedia(out.trace, midias);
          if (out.resolved.status === "matched") {
            fail(msg, "invenção: criativo sem produto matchou mídia", out.trace);
          }
          return out;
        },
      });
    }
  }

  // 13) Briefing longo
  cases.push({
    id: "13-longo:roupa+preço+estilo+cenario+lixo",
    group: "13-longo",
    run: async (setTrace) => {
      const midias = toTenantMidias(EMPRESA_ROUPAS.midias);
      const msg =
        "Quero um lançamento da camiseta preta com vibe premium, espaço para chamada, clima de verão, fundo de loja, preço grande 89,90, estética moderna, elementos que remetam a moda e propaganda de revista, usando composição clean.";
      const out = await runTurn(msg, { midias, empresaId: EMPRESA_ROUPAS.id_empresa });
      setTrace(out.trace);
      logTrace(out.trace);
      assertNoCreativeAsProduct(out.trace);
      const nome = String(out.candidate.nome || "");
      for (const bad of ["espaco", "chamada", "verao", "propaganda", "revista", "lancamento"]) {
        if (new RegExp(`\\b${bad}\\b`, "i").test(nome)) {
          fail("13", `interpretação absurda: «${bad}» entrou no ProductCandidate`, out.trace);
        }
      }
      if (out.resolved.status !== "matched" || !midiaIds(out.resolved.matches).includes("camiseta-preta")) {
        fail("13", `produto errado no briefing longo: ${out.resolved.status}`, out.trace);
      }
      return out;
    },
  });

  // 14) Briefing curto
  for (const spec of [
    { msg: "camiseta preta, 79,90", id: "camiseta-preta", empresa: EMPRESA_ROUPAS },
    { msg: "faz do fone bluetooth", id: "fone-bluetooth", empresa: EMPRESA_ELETRONICOS },
    { msg: "café torrado pra promoção", id: "cafe-torrado", empresa: EMPRESA_ALIMENTOS },
  ]) {
    cases.push({
      id: `14-curto:${spec.msg}`,
      group: "14-curto",
      run: async (setTrace) => {
        const midias = toTenantMidias(spec.empresa.midias);
        const out = await runTurn(spec.msg, { midias, empresaId: spec.empresa.id_empresa });
        setTrace(out.trace);
        logTrace(out.trace);
        if (out.resolved.status !== "matched" || !midiaIds(out.resolved.matches).includes(spec.id)) {
          fail(spec.msg, `produto errado no curto: esperado ${spec.id}`, out.trace);
        }
        if (out.interpret.turn?.needsProductClarification) {
          fail(spec.msg, "pergunta desnecessária: produto já estava claro", out.trace);
        }
        return out;
      },
    });
  }

  // 15) Contradições criativas
  for (const msg of [
    "faz arte da jaqueta jeans minimalista mas chamativo",
    "sofa 3 lugares com fundo claro escuro",
    "perfume floral 100ml sem texto mas com preço 99",
  ]) {
    cases.push({
      id: `15-contrad:${msg.slice(0, 40)}`,
      group: "15-contrad",
      run: async (setTrace) => {
        const empresa = /jaqueta/.test(msg)
          ? EMPRESA_ROUPAS
          : /sofa/.test(msg)
            ? EMPRESA_CASA
            : EMPRESA_COSMETICOS;
        const midias = toTenantMidias(empresa.midias);
        const out = await runTurn(msg, { midias, empresaId: empresa.id_empresa });
        setTrace(out.trace);
        logTrace(out.trace);
        assertNoInventedMedia(out.trace, midias);
        assertReplyDoesNotClaimGeneration(out.trace);
        // Só falha se inventar mídia ou apagar produto claro.
        if (out.resolved.status === "missing" && /jaqueta|sofa|perfume/i.test(msg)) {
          // soft: pode ser ok se LLM poluiu; marca como produto se sumiu totalmente
          if (!out.interpret.state.produto && !out.candidate.nome) {
            fail(msg, "perda de contexto em contradição criativa", out.trace);
          }
        }
        return out;
      },
    });
  }

  // 16) Negação
  cases.push({
    id: "16-negacao:sem preço / não muda produto / usa o outro",
    group: "16-negacao",
    run: async (setTrace) => {
      const midias = toTenantMidias(EMPRESA_CASA.midias);
      const t1 = await runTurn("faz divulgação do sofá 3 lugares com 599,90", {
        midias,
        empresaId: EMPRESA_CASA.id_empresa,
      });
      const t2 = await runTurn("sem preço", {
        midias,
        empresaId: EMPRESA_CASA.id_empresa,
        prevState: t1.interpret.state,
        history: [{ role: "user", content: "faz divulgação do sofá 3 lugares com 599,90" }],
      });
      const t3 = await runTurn("não muda o produto", {
        midias,
        empresaId: EMPRESA_CASA.id_empresa,
        prevState: t2.interpret.state,
        history: [
          { role: "user", content: "faz divulgação do sofá 3 lugares com 599,90" },
          { role: "user", content: "sem preço" },
        ],
      });
      const t4 = await runTurn("não quero esse, usa a luminária de mesa", {
        midias,
        empresaId: EMPRESA_CASA.id_empresa,
        prevState: t3.interpret.state,
        history: [
          { role: "user", content: "faz divulgação do sofá 3 lugares com 599,90" },
          { role: "user", content: "sem preço" },
          { role: "user", content: "não muda o produto" },
        ],
      });
      setTrace(t4.trace);
      logTrace(t4.trace);
      assertNoInventedMedia(t4.trace, midias);
      if (t4.resolved.status === "matched" && !midiaIds(t4.resolved.matches).includes("luminaria-mesa")) {
        fail("16", "produto errado após «usa o outro»", t4.trace);
      }
      return t4;
    },
  });

  // 17) Conversa natural 6–8 turnos
  cases.push({
    id: "17-natural:alimentos 7 turnos",
    group: "17-natural",
    run: async (setTrace) => {
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
        last = await runTurn(msg, {
          midias,
          empresaId: EMPRESA_ALIMENTOS.id_empresa,
          prevState: state,
          history,
        });
        state = last.interpret.state;
        history = [...history, { role: "user", content: msg }];
        logTrace(last.trace);
      }
      setTrace(last.trace);
      assertNoInventedMedia(last.trace, midias);
      if (last.resolved.status === "matched") {
        assert.deepEqual(midiaIds(last.resolved.matches), ["cafe-torrado"]);
      } else if (!/cafe|café/i.test(String(last.interpret.state.produto || ""))) {
        fail("17", "perda de contexto na conversa natural", last.trace);
      }
      if (last.interpret.state.oferta && !/24/.test(String(last.interpret.state.oferta))) {
        fail("17", "preço errado no final da conversa", last.trace);
      }
      return last;
    },
  });

  // 18) Correções sucessivas
  cases.push({
    id: "18-correcoes:perfume→hidratante→perfume→outro",
    group: "18-correcoes",
    run: async (setTrace) => {
      const midias = toTenantMidias(EMPRESA_COSMETICOS.midias);
      const steps = [
        "faz com o perfume floral 100ml",
        "não, o hidratante rose",
        "quer dizer, o perfume floral 50ml",
        "não esse, o outro perfume",
      ];
      let state = emptyCreationState();
      let history = [];
      let last;
      for (const msg of steps) {
        last = await runTurn(msg, {
          midias,
          empresaId: EMPRESA_COSMETICOS.id_empresa,
          prevState: state,
          history,
        });
        state = last.interpret.state;
        history = [...history, { role: "user", content: msg }];
        logTrace(last.trace);
      }
      setTrace(last.trace);
      // Último: "o outro perfume" com 100ml e 50ml → deve perguntar (ambiguous) ou não inventar.
      if (last.resolved.status === "matched") {
        // aceitável se for um perfume; grave se for hidratante (contaminação)
        if (midiaIds(last.resolved.matches).includes("hidratante-rose")) {
          fail("18", "produto errado/contaminação: ficou no hidratante após correções", last.trace);
        }
      }
      assertNoInventedMedia(last.trace, midias);
      return last;
    },
  });

  // 19) Usuário vago — liberdade criativa
  for (const msg of [
    "quero uma coisa bonita",
    "não sei explicar",
    "tipo anúncio de loja grande",
    "você decide",
  ]) {
    cases.push({
      id: `19-vago:${msg}`,
      group: "19-vago",
      run: async (setTrace) => {
        const midias = toTenantMidias(EMPRESA_PAPELARIA.midias);
        const t0 = await runTurn("faz um post do caderno universitario", {
          midias,
          empresaId: EMPRESA_PAPELARIA.id_empresa,
        });
        const out = await runTurn(msg, {
          midias,
          empresaId: EMPRESA_PAPELARIA.id_empresa,
          prevState: t0.interpret.state,
          history: [{ role: "user", content: "faz um post do caderno universitario" }],
        });
        setTrace(out.trace);
        logTrace(out.trace);
        assertNoCreativeAsProduct(out.trace);
        assertNoInventedMedia(out.trace, midias);
        // Com produto prévio, "você decide" não deve apagar produto nem inventar outro.
        if (
          out.resolved.status === "matched" &&
          !midiaIds(out.resolved.matches).includes("caderno-universitario")
        ) {
          fail(msg, "produto errado sob liberdade criativa", out.trace);
        }
        return out;
      },
    });
  }

  // 20) Perguntas — necessário vs desnecessário
  cases.push({
    id: "20-pergunta:vaga precisa / explícita não",
    group: "20-pergunta",
    run: async (setTrace) => {
      const midias = toTenantMidias(EMPRESA_ROUPAS.midias);
      const vague = await runTurn("faz uma arte disso", {
        midias,
        empresaId: EMPRESA_ROUPAS.id_empresa,
      });
      const clear = await runTurn("faz uma arte da camiseta preta", {
        midias,
        empresaId: EMPRESA_ROUPAS.id_empresa,
      });
      setTrace(clear.trace);
      logTrace(vague.trace);
      logTrace(clear.trace);
      if (vague.resolved.status === "matched") {
        fail("20", "falta de pergunta: «disso» resolveu mídia", vague.trace);
      }
      if (clear.interpret.turn?.needsProductClarification) {
        fail("20", "pergunta desnecessária com produto explícito", clear.trace);
      }
      if (clear.resolved.status !== "matched") {
        fail("20", "produto errado no caso explícito", clear.trace);
      }
      return clear;
    },
  });

  // 21) Resposta textual
  cases.push({
    id: "21-resposta:missing não confirma",
    group: "21-resposta",
    run: async (setTrace) => {
      const midias = toTenantMidias(EMPRESA_AUTOMOTIVO.midias);
      const out = await runTurn("quero arte do Produto X xyz", {
        midias,
        empresaId: EMPRESA_AUTOMOTIVO.id_empresa,
      });
      setTrace(out.trace);
      logTrace(out.trace);
      assertReplyDoesNotClaimGeneration(out.trace);
      const r = String(out.reply || "").toLowerCase();
      if (/\b(uuid|id_midia|embedding|json|schema)\b/.test(r)) {
        fail("21", "resposta textual incoerente: vazou detalhe interno", out.trace);
      }
      return out;
    },
  });

  // 22) Web — formato UI + alteração explícita
  cases.push({
    id: "22-web:formato UI + troca story",
    group: "22-web",
    run: async (setTrace) => {
      const midias = toTenantMidias(EMPRESA_SUPLEMENTOS.midias);
      const t1 = await runTurn("campanha do pro force morango 19,90 moderno", {
        midias,
        empresaId: EMPRESA_SUPLEMENTOS.id_empresa,
        uiFormat: "1:1",
      });
      const t2 = await runTurn("faz pra story", {
        midias,
        empresaId: EMPRESA_SUPLEMENTOS.id_empresa,
        prevState: t1.interpret.state,
        history: [{ role: "user", content: "campanha do pro force morango 19,90 moderno" }],
        uiFormat: "1:1",
      });
      setTrace(t2.trace);
      logTrace(t1.trace);
      logTrace(t2.trace);
      if (t1.resolved.status === "matched") {
        assert.deepEqual(midiaIds(t1.resolved.matches), ["pf-morango"]);
      }
      // Preservar produto/preço ao mudar formato
      if (t1.interpret.state.produto && !t2.interpret.state.produto) {
        fail("22", "perda de contexto: formato apagou produto", t2.trace);
      }
      if (t1.interpret.state.oferta && t2.interpret.state.oferta && t1.interpret.state.oferta !== t2.interpret.state.oferta) {
        // allow if still has digits of price
        if (!/\d/.test(String(t2.interpret.state.oferta))) {
          fail("22", "preço errado após troca de formato", t2.trace);
        }
      }
      const fmt = String(t2.trace.interpretation?.formato_hint || t2.trace.briefing?.formato_arte_brief || "");
      // Se o interpretador capturou formato, deve apontar story/9:16; se não, registra limitação via soft check.
      if (fmt && !/9:16|story|stories|vertical/i.test(fmt) && !/story/i.test(String(t2.entities?.formato || ""))) {
        // só falha se inventou formato errado explícito
        if (/16:9|horizontal|quadrado|1:1/i.test(fmt)) {
          fail("22", `formato errado: pediu story, veio ${fmt}`, t2.trace);
        }
      }
      return t2;
    },
  });

  // 23) WhatsApp — formatos falados
  for (const msg of QUICK
    ? ["faz pra story", "manda em 16:9"]
    : ["faz pra story", "quero quadrado", "faz horizontal", "manda em 16:9"]) {
    cases.push({
      id: `23-wpp:${msg}`,
      group: "23-wpp",
      run: async (setTrace) => {
        const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
        const t1 = await runTurn("propaganda do teclado mecanico", {
          midias,
          empresaId: EMPRESA_ELETRONICOS.id_empresa,
        });
        const t2 = await runTurn(msg, {
          midias,
          empresaId: EMPRESA_ELETRONICOS.id_empresa,
          prevState: t1.interpret.state,
          history: [{ role: "user", content: "propaganda do teclado mecanico" }],
        });
        setTrace(t2.trace);
        logTrace(t2.trace);
        if (t1.interpret.state.produto && !t2.interpret.state.produto) {
          fail(msg, "perda de contexto: formato WhatsApp apagou produto", t2.trace);
        }
        assertNoInventedMedia(t2.trace, midias);
        return t2;
      },
    });
  }

  // 24) Multicategoria — mesmos padrões
  for (const a of pickAnchors) {
    cases.push({
      id: `24-multi:curta+produto:${a.key}`,
      group: "24-multi",
      run: async (setTrace) => {
        const midias = toTenantMidias(a.empresa.midias);
        const t1 = await runTurn(`faz post d${/^[aeiou]/i.test(a.nome) ? "o" : "e"} ${a.nome}`, {
          midias,
          empresaId: a.empresa.id_empresa,
        });
        const t2 = await runTurn("deixa top", {
          midias,
          empresaId: a.empresa.id_empresa,
          prevState: t1.interpret.state,
          history: [{ role: "user", content: `faz post do ${a.nome}` }],
        });
        setTrace(t2.trace);
        logTrace(t1.trace);
        logTrace(t2.trace);
        assertNoInventedMedia(t2.trace, midias);
        if (t1.resolved.status === "matched" && !midiaIds(t1.resolved.matches).includes(a.expectId)) {
          fail(a.key, `produto/mídia errada em ${a.key}`, t1.trace);
        }
        if (
          t1.resolved.status === "matched" &&
          t2.resolved.status === "matched" &&
          midiaIds(t2.resolved.matches)[0] !== a.expectId
        ) {
          fail(a.key, `perda de contexto multicategoria (${a.key})`, t2.trace);
        }
        return t2;
      },
    });
  }

  // Produto novo (ainda stress, sem regra de categoria)
  cases.push({
    id: "24-novo:diffuser cadastrado",
    group: "24-multi",
    run: async (setTrace) => {
      const midias = toTenantMidias([...EMPRESA_PRODUTO_NOVO_BASE.midias, PRODUTO_C_NOVO]);
      const out = await runTurn("divulga o diffuser ultrasonic mist", {
        midias,
        empresaId: EMPRESA_PRODUTO_NOVO_BASE.id_empresa,
      });
      setTrace(out.trace);
      logTrace(out.trace);
      if (out.resolved.status !== "matched" || !midiaIds(out.resolved.matches).includes("produto-c-diffuser")) {
        fail("novo", "produto errado: produto recém-cadastrado não resolveu", out.trace);
      }
      return out;
    },
  });

  return cases;
}

describe("estresse conversacional pré-feira (Llama)", () => {
  it("pré-condições Llama", async (t) => {
    if (!isCreationLlmInterpretEnabled()) {
      t.skip("CHAT_CREATION_LLM_INTERPRET=true necessário");
      return;
    }
    if (!isCreationLlmOllama()) {
      t.skip("CHAT_CREATION_LLM_PROVIDER=ollama necessário");
      return;
    }
    assert.equal(true, true);
  });

  const cases = buildCases();
  for (const c of cases) {
    caseTest(c.id, async (setTrace) => c.run(setTrace));
  }
});

after(() => {
  const total = RESULTS.length;
  const passed = RESULTS.filter((r) => r.ok).length;
  const failed = RESULTS.filter((r) => !r.ok);
  const rate = total ? ((passed / total) * 100).toFixed(1) : "0";

  /** @type {Record<string, string[]>} */
  const byFamily = {};
  for (const f of FAILURES) {
    for (const fam of f.families || ["outra"]) {
      byFamily[fam] = byFamily[fam] || [];
      byFamily[fam].push(f.id);
    }
  }

  console.log("\n========== RESUMO ESTRESSE CONVERSACIONAL ==========");
  console.log(`Total: ${total}`);
  console.log(`Passaram: ${passed}`);
  console.log(`Falharam: ${failed.length}`);
  console.log(`Taxa de sucesso: ${rate}%`);
  console.log(`Modo: ${QUICK ? "STRESS_QUICK" : "completo"}`);
  console.log("\n--- Falhas por família ---");
  const families = [
    "produto errado",
    "atributo errado",
    "intenção errada",
    "estilo errado",
    "cenário errado",
    "preço errado",
    "formato errado",
    "perda de contexto",
    "alteração destrutiva",
    "pergunta desnecessária",
    "falta de pergunta",
    "invenção",
    "mídia errada",
    "resposta textual incoerente",
    "falsa confirmação",
    "outra",
  ];
  for (const fam of families) {
    const ids = byFamily[fam] || [];
    console.log(`${fam}: ${ids.length ? ids.join(" | ") : "—"}`);
  }
  console.log("\n--- Exemplos (até 8) ---");
  for (const f of failed.slice(0, 8)) {
    console.log(`* ${f.id}`);
    console.log(`  famílias: ${(f.families || []).join(", ")}`);
    console.log(`  detalhe: ${f.detail}`);
    const t = f.trace && typeof f.trace === "object" ? f.trace : null;
    if (t) {
      console.log(
        `  snap: prod=${t.state_after?.produto || "∅"} resolve=${t.resolve?.status} ids=${(t.resolve?.ids || []).join(",") || "∅"} reply=${String(t.resposta || "").slice(0, 80)}`,
      );
    }
  }
  console.log("====================================================\n");
});
