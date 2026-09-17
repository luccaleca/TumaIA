/**
 * Bateria semântica do agente de criação — SEM gerar imagem.
 * Avalia: mensagem → interpretação → estado → arte_brief/payload hipotético.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  parseCreationTurn,
  mergeCreationState,
  emptyCreationState,
  deriveCreationStateFromHistory,
  shouldPreferImageBriefingOverAcervo,
} from "../../backend/src/services/chatCreationInterpret.js";
import {
  buildArteBriefFromHistory,
  aspectRatioFromArteBrief,
  normalizeArteBrief,
} from "../../backend/src/services/rawImageArteBrief.js";
import {
  formatoToJson,
  getFormatPresetById,
  tryDetectFormatPresetFromText,
} from "../../backend/src/services/arteFormatPresets.js";

/** @type {{ id: string, title: string, ok: boolean, detail?: string }[]} */
const RESULTS = [];

/**
 * @param {string} id
 * @param {string} title
 * @param {() => void} fn
 */
function caseTest(id, title, fn) {
  it(`${id} — ${title}`, () => {
    try {
      fn();
      RESULTS.push({ id, title, ok: true });
    } catch (err) {
      const detail =
        err instanceof assert.AssertionError
          ? `esperado=${JSON.stringify(err.expected)} recebido=${JSON.stringify(err.actual)} | ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      RESULTS.push({ id, title, ok: false, detail });
      throw err;
    }
  });
}

/**
 * @param {ReturnType<typeof parseCreationTurn> | ReturnType<typeof emptyCreationState>} got
 */
function snap(got) {
  if ("productQuery" in got || "intent" in got) {
    const t = /** @type {ReturnType<typeof parseCreationTurn>} */ (got);
    return {
      produto: t.productQuery || "",
      intencao: t.intent || "",
      cenario: t.scenario || "",
      tema: t.theme || "",
      oferta: t.offer || "",
      estilo: (t.style || []).join(", "),
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
  };
}

function assertOffer(got, re) {
  assert.match(String(got || ""), re);
}

function assertProduct(got, re) {
  assert.match(String(got || ""), re);
}

describe("bateria semântica — criação (sem imagem)", () => {
  // ——— 1. Interpretação básica ———
  caseTest("01", "arte desse whey na academia", () => {
    const t = parseCreationTurn("Quero uma arte desse whey na academia.");
    assertProduct(t.productQuery, /whey/i);
    assert.equal(t.scenario, "academia");
    assert.doesNotMatch(t.productQuery || "", /academia/i);
  });

  caseTest("02", "promoção whey por R$ 79,90", () => {
    const t = parseCreationTurn("Faz uma promoção desse whey por R$ 79,90.");
    assertProduct(t.productQuery, /whey/i);
    assert.equal(t.intent, "promocao");
    assertOffer(t.offer, /79/);
  });

  caseTest("03", "valor 79,90 bem grande", () => {
    const t = parseCreationTurn("Coloca o valor de 79,90 bem grande.");
    assertOffer(t.offer, /79/);
    assert.match(t.layout || "", /pre[cç]o|destaque|grande/i);
  });

  caseTest("04", "moderno e profissional", () => {
    const t = parseCreationTurn("Quero algo moderno e profissional.");
    assert.ok(t.style.some((s) => /moderno/i.test(s)));
    assert.ok(t.style.some((s) => /profissional/i.test(s)));
  });

  caseTest("05", "fotografia real → photorealistic", () => {
    const t = parseCreationTurn("Faz parecer uma fotografia real.");
    assert.ok(t.style.some((s) => /photorealistic|realista|fotografia/i.test(s)));
    assert.equal(t.productQuery, null);
  });

  // ——— 2. Frase completa ———
  caseTest("06", "frase completa academia + preço (não misturar)", () => {
    const q =
      "Quero uma arte promocional desse whey, com fundo de academia e o preço de R$ 79,90 bem destacado. Algo moderno e profissional.";
    const t = parseCreationTurn(q);
    assertProduct(t.productQuery, /whey/i);
    assert.equal(t.intent, "promocao");
    assert.equal(t.scenario, "academia");
    assertOffer(t.offer, /79/);
    assert.match(t.layout || "", /pre[cç]o|destaque/i);
    assert.ok(t.style.some((s) => /moderno|profissional/i.test(s)));
    assert.doesNotMatch(t.scenario || "", /79|preco|preço/i);
    const brief = buildArteBriefFromHistory([{ role: "user", content: q }], []);
    assert.doesNotMatch(brief.tema, /Academia o Preco/i);
    assert.match(brief.texto || brief.tema, /79/);
  });

  caseTest("07", "campanha verão + academia + oferta", () => {
    const t = parseCreationTurn(
      "Faz uma campanha de verão para esse whey, coloca ele em uma academia e deixa a oferta de 79,90 chamando atenção.",
    );
    assertProduct(t.productQuery, /whey/i);
    assert.match(t.theme || "", /ver[aã]o/i);
    assert.equal(t.scenario, "academia");
    assertOffer(t.offer, /79/);
    assert.match(t.layout || "", /pre[cç]o|destaque|oferta|aten/i);
  });

  caseTest("08", "photorealistic + premium + preço grande", () => {
    const t = parseCreationTurn(
      "Quero esse whey numa academia com aparência photorealistic, preço grande e visual premium.",
    );
    assertProduct(t.productQuery, /whey/i);
    assert.equal(t.scenario, "academia");
    assert.ok(t.style.some((s) => /photorealistic/i.test(s)));
    assert.ok(t.style.some((s) => /premium/i.test(s)));
    assert.match(t.layout || "", /pre[cç]o|destaque/i);
  });

  // ——— 3. Variação semântica do preço ———
  for (const [id, q] of [
    ["09", "Vende esse whey por 79,90."],
    ["10", "Coloca esse whey por R$ 79,90."],
    ["11", "O valor desse whey é 79,90."],
    ["12", "Quero a oferta desse produto em R$ 79,90."],
    ["13", "Deixa o preço em 79,90."],
  ]) {
    caseTest(id, `variação preço: ${q}`, () => {
      const t = parseCreationTurn(q);
      assertOffer(t.offer, /79/);
      assert.doesNotMatch(t.scenario || "", /79|preco/i);
    });
  }

  // ——— 4. Contexto entre mensagens ———
  caseTest("14", "multi-turno: produto→preço→destaque→estilo", () => {
    let state = emptyCreationState();
    state = mergeCreationState(state, parseCreationTurn("Quero uma arte desse whey na academia."));
    assertProduct(state.produto, /whey/i);
    assert.equal(state.cenario, "academia");

    state = mergeCreationState(state, parseCreationTurn("Coloca por 79,90."));
    assertOffer(state.oferta, /79/);
    assertProduct(state.produto, /whey/i);
    assert.equal(state.cenario, "academia");

    state = mergeCreationState(state, parseCreationTurn("Deixa o valor bem grande."));
    assert.match(state.destaque || "", /pre[cç]o|destaque/i);
    assertOffer(state.oferta, /79/);

    state = mergeCreationState(state, parseCreationTurn("Agora faz mais premium."));
    assert.match(state.estilo || "", /premium/i);
    assertProduct(state.produto, /whey/i);
    assert.equal(state.cenario, "academia");
    assertOffer(state.oferta, /79/);
    assert.match(state.destaque || "", /pre[cç]o|destaque/i);
  });

  // ——— 5. Alterações pontuais ———
  caseTest("15", "muda só o preço", () => {
    let state = deriveCreationStateFromHistory([
      { role: "user", content: "Quero esse whey na academia por R$ 79,90." },
    ]);
    state = mergeCreationState(state, parseCreationTurn("Agora muda para R$ 69,90."));
    assertOffer(state.oferta, /69/);
    assert.doesNotMatch(state.oferta || "", /79/);
    assertProduct(state.produto, /whey/i);
    assert.equal(state.cenario, "academia");
  });

  caseTest("16", "muda só o cenário", () => {
    let state = deriveCreationStateFromHistory([
      { role: "user", content: "Quero esse whey na academia por R$ 79,90." },
    ]);
    state = mergeCreationState(state, parseCreationTurn("Agora coloca em uma praia."));
    assert.equal(state.cenario, "praia");
    assertProduct(state.produto, /whey/i);
    assertOffer(state.oferta, /79/);
  });

  caseTest("17", "muda só o formato 9:16", () => {
    const history = [
      { role: "user", content: "Quero esse whey na academia por R$ 79,90." },
      { role: "user", content: "Agora faz em formato 9:16." },
    ];
    const draft = normalizeArteBrief({
      tema: "whey academia",
      formato: formatoToJson(getFormatPresetById("post_square")),
      texto: "R$79,90",
      estilo: "premium",
    });
    const preset = tryDetectFormatPresetFromText("Agora faz em formato 9:16.");
    assert.ok(preset);
    assert.equal(preset.ratio, "9:16");
    const next = normalizeArteBrief({ ...draft, formato: formatoToJson(preset) });
    assert.equal(next.formato.ratio, "9:16");
    assert.equal(next.texto, draft.texto);
    assert.equal(next.estilo, draft.estilo);
    const state = deriveCreationStateFromHistory(history);
    assertProduct(state.produto, /whey/i);
    assertOffer(state.oferta, /79/);
  });

  // ——— 6. Troca de produto ———
  caseTest("18", "troca whey → creatina", () => {
    let state = deriveCreationStateFromHistory([
      { role: "user", content: "Quero uma arte do whey na academia por R$ 79,90." },
    ]);
    state = mergeCreationState(state, parseCreationTurn("Agora faz com a creatina."));
    assertProduct(state.produto, /creatina/i);
    assert.doesNotMatch(state.produto || "", /whey/i);
    assert.equal(state.cenario, "academia");
    assertOffer(state.oferta, /79/);
  });

  // ——— 7. Decisão criativa (não exigir perguntas de luz/câmera) ———
  caseTest("19", "produto+preço bastam — sem exigir iluminação", () => {
    const q = "Quero uma arte desse whey por R$ 79,90.";
    const t = parseCreationTurn(q);
    assertProduct(t.productQuery, /whey/i);
    assertOffer(t.offer, /79/);
    assert.equal(shouldPreferImageBriefingOverAcervo(q), true);
    // Campos criativos opcionais podem ficar vazios — isso é OK.
    assert.ok(!t.needsProductClarification);
  });

  // ——— 8. Pergunta necessária ———
  caseTest("20", "produto novo vago → precisa clarificar", () => {
    const t = parseCreationTurn("Quero uma arte daquele produto novo.");
    assert.equal(t.needsProductClarification, true);
    assert.equal(t.productQuery, null);
  });

  // ——— 9. Ambíguos preço × cenário ———
  caseTest("21", "preço + academia na mesma frase", () => {
    const t = parseCreationTurn("Quero uma arte com preço de 79,90 em uma academia.");
    assertOffer(t.offer, /79/);
    assert.equal(t.scenario, "academia");
    assert.doesNotMatch(t.scenario || "", /79|preco/i);
  });

  caseTest("22", "academia + oferta 79,90", () => {
    const t = parseCreationTurn("Quero uma arte para academia com uma oferta de 79,90.");
    assert.equal(t.scenario, "academia");
    assertOffer(t.offer, /79/);
  });

  caseTest("23", "preço destacado no fundo da academia", () => {
    const t = parseCreationTurn("Quero o preço bem destacado no fundo da academia.");
    assert.equal(t.scenario, "academia");
    assert.match(t.layout || "", /pre[cç]o|destaque/i);
    assert.doesNotMatch(t.scenario || "", /preco|destaque/i);
  });

  // ——— 10. Estilos isolados ———
  for (const [id, q, re] of [
    ["24a", "Faz photorealistic.", /photorealistic/i],
    ["24b", "Faz cinematic.", /cinematic/i],
    ["24c", "Faz minimalista.", /minimal/i],
    ["24d", "Faz premium.", /premium/i],
    ["24e", "Faz editorial.", /editorial/i],
    ["24f", "Faz moderno.", /moderno/i],
    ["24g", "Faz mais vibrante.", /vibrante/i],
  ]) {
    caseTest(id, `estilo: ${q}`, () => {
      const t = parseCreationTurn(q);
      assert.ok(t.style.some((s) => re.test(s)), `style=${JSON.stringify(t.style)}`);
      assert.equal(t.scenario, "");
      assert.equal(t.offer, "");
      assert.ok(!t.productQuery || !/vibrante|moderno|premium|cinematic/i.test(t.productQuery));
    });
  }

  // ——— 11. Ordem das informações ———
  for (const [id, q] of [
    ["25a", "R$ 79,90, quero esse whey numa academia."],
    ["25b", "Esse whey, numa academia, por 79,90."],
    ["25c", "Numa academia, coloca esse whey por 79,90."],
    ["25d", "Quero esse whey por 79,90 com fundo de academia."],
  ]) {
    caseTest(id, `ordem livre: ${q}`, () => {
      const t = parseCreationTurn(q);
      assertProduct(t.productQuery, /whey/i);
      assert.equal(t.scenario, "academia");
      assertOffer(t.offer, /79/);
    });
  }

  // ——— 12. Preservação ———
  caseTest("26", "photorealistic não apaga preço/cenário", () => {
    let state = emptyCreationState();
    state.produto = "whey";
    state.cenario = "academia";
    state.oferta = "R$79,90";
    state.estilo = "premium";
    state = mergeCreationState(state, parseCreationTurn("Agora deixa photorealistic."));
    assertProduct(state.produto, /whey/i);
    assert.equal(state.cenario, "academia");
    assertOffer(state.oferta, /79/);
    assert.match(state.estilo || "", /photorealistic/i);
  });

  // ——— 13. Formato web ———
  caseTest("27", "seletor 4:5 sem mencionar formato", () => {
    const ui = normalizeArteBrief({
      formato: formatoToJson(getFormatPresetById("feed_portrait")),
      tema: "",
    });
    const q = "Quero uma promoção desse whey por 79,90.";
    const t = parseCreationTurn(q);
    assert.equal(tryDetectFormatPresetFromText(q), null);
    const brief = normalizeArteBrief({
      ...buildArteBriefFromHistory([{ role: "user", content: q }], [], ui),
      formato: ui.formato,
    });
    assert.equal(brief.formato.ratio, "4:5");
    assert.equal(aspectRatioFromArteBrief(brief), "2:3");
    assertOffer(t.offer, /79/);
  });

  caseTest("28", "usuário sobrescreve para 9:16", () => {
    const ui = normalizeArteBrief({
      formato: formatoToJson(getFormatPresetById("feed_portrait")),
      texto: "R$79,90",
      tema: "whey promo",
    });
    const preset = tryDetectFormatPresetFromText("Faz em 9:16.");
    assert.equal(preset?.ratio, "9:16");
    const brief = normalizeArteBrief({ ...ui, formato: formatoToJson(preset) });
    assert.equal(brief.formato.ratio, "9:16");
    assert.equal(brief.texto, "R$79,90");
    assert.equal(brief.tema, "whey promo");
  });

  // ——— payload hipotético (sem chamar provedor) ———
  caseTest("29", "arte_brief/payload hipotético preenchido", () => {
    const q =
      "Quero uma arte promocional desse whey, com fundo de academia e o preço de R$ 79,90 bem destacado.";
    const history = [{ role: "user", content: q }];
    const state = deriveCreationStateFromHistory(history);
    const brief = buildArteBriefFromHistory(history, ["#111"], {
      formato: formatoToJson(getFormatPresetById("landscape")),
    });
    const payload = {
      aspect_ratio: aspectRatioFromArteBrief(brief),
      arte_brief: brief,
      interpretation: snap(state),
      would_call_image_api: false,
    };
    assert.equal(payload.would_call_image_api, false);
    assert.equal(payload.aspect_ratio, "16:9");
    assertProduct(payload.interpretation.produto, /whey/i);
    assert.equal(payload.interpretation.cenario, "academia");
    assertOffer(payload.interpretation.oferta, /79/);
    assert.match(payload.arte_brief.texto || payload.arte_brief.tema, /79/);
  });

  after(() => {
    const passed = RESULTS.filter((r) => r.ok).length;
    const failed = RESULTS.filter((r) => !r.ok);
    console.log("\n========== RESUMO BATERIA SEMÂNTICA ==========");
    console.log(`Total de testes: ${RESULTS.length}`);
    console.log(`Passaram: ${passed}`);
    console.log(`Falharam: ${failed.length}`);
    if (failed.length) {
      console.log("\nFalhas:");
      for (const f of failed) {
        console.log(`- ${f.id} ${f.title}`);
        console.log(`  ${f.detail}`);
      }
    }
    console.log("==============================================\n");
  });
});
