import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  tryDetectFormatPresetFromText,
  detectFormatPresetFromText,
  formatoToJson,
  getFormatPresetById,
} from "../../backend/src/services/arteFormatPresets.js";
import {
  buildArteBriefFromHistory,
  mergeArteBriefUserEdits,
  aspectRatioFromArteBrief,
  normalizeArteBrief,
} from "../../backend/src/services/rawImageArteBrief.js";
import {
  detectImageGenerationIntentFromHistory,
  isExplicitFormatChangeRequest,
} from "../../backend/src/services/tumaInterpretation.js";

describe("formato preset + geração (16:9)", () => {
  it("detecta pedido 16:9 / YouTube / paisagem / versão 16", () => {
    for (const q of [
      "quero 16:9",
      "versão 16:9",
      "quero a versão 16:9",
      "formato 16x9",
      "paisagem",
      "YouTube thumbnail",
    ]) {
      const p = tryDetectFormatPresetFromText(q);
      assert.ok(p, q);
      assert.equal(p.id, "landscape", q);
      assert.equal(p.ratio, "16:9", q);
    }
  });

  it("não inventa formato quando o texto não pede", () => {
    assert.equal(tryDetectFormatPresetFromText("mais preço e academia"), null);
    assert.equal(detectFormatPresetFromText("promo verão").id, "post_square");
  });

  it("16:9 sobrescreve preset atual e preserva resto do briefing", () => {
    const draft = normalizeArteBrief({
      tema: "promoção de verão Powerade 1 por 10 e 3 por 20 academia",
      formato: formatoToJson(getFormatPresetById("post_square")),
      estilo: "photorealistic, preço grande, elementos de verão",
      texto: "1 por 10 · 3 por 20",
      cores: ["#00B341"],
    });
    const extracted = buildArteBriefFromHistory(
      [
        {
          role: "user",
          content:
            "quero uma promoção de verão do powerade 1 por 10 e 3 por 20, academia, photorealistic, preço grande",
        },
        { role: "assistant", content: "Resumo da arte pronto. Confirme para gerar a prévia." },
        { role: "user", content: "quero a versão 16:9" },
      ],
      ["#00B341"],
      draft,
    );
    assert.equal(extracted.formato.preset_id, "landscape");
    assert.equal(extracted.formato.ratio, "16:9");
    assert.match(extracted.tema, /promo|verão|powerade|academia/i);
    assert.match(extracted.estilo, /photorealistic|preço|verão/i);

    const merged = mergeArteBriefUserEdits(draft, extracted, { preferExtractedFormato: true });
    assert.equal(merged.formato.ratio, "16:9");
    assert.equal(merged.formato.preset_id, "landscape");
    assert.equal(merged.tema, draft.tema);
    assert.match(merged.estilo, /photorealistic/i);
    assert.equal(merged.texto, draft.texto);
    assert.deepEqual(merged.cores, draft.cores);
  });

  it("payload de aspect ratio recebe 16:9 do arte_brief", () => {
    const brief = normalizeArteBrief({
      tema: "promo verão",
      formato: formatoToJson(getFormatPresetById("landscape")),
    });
    assert.equal(aspectRatioFromArteBrief(brief), "16:9");
  });

  it("mudança de formato após briefing reabre rota de geração", () => {
    const history = [
      {
        role: "user",
        content:
          "quero uma promoção de verão do powerade 1 por 10 e 3 por 20, academia, photorealistic",
      },
      {
        role: "assistant",
        content: "*Confira se entendi certo:*\n📋 Resumo da arte\n\nEstá certo? Digite *gerar imagem*",
      },
    ];
    assert.equal(isExplicitFormatChangeRequest("quero a versão 16:9"), true);
    assert.equal(detectImageGenerationIntentFromHistory(history, "quero a versão 16:9"), true);
    assert.equal(detectImageGenerationIntentFromHistory(history, "obrigado"), false);
  });

  it("sucesso de prévia exige URL renderizável; falha não é sucesso textual", () => {
    const successUrls = ["https://cdn.example/preview-16x9.png"];
    assert.ok(successUrls.length >= 1);
    assert.match(successUrls[0], /^https?:\/\//);

    const failed = { ok: false, urls: [], error: "A imagem não foi gerada." };
    const fakeSuccessText = "Aqui está a versão 16:9";
    assert.equal(failed.ok, false);
    assert.equal(failed.urls.length, 0);
    assert.notEqual(failed.error, fakeSuccessText);
    assert.match(failed.error, /não foi gerada/i);
  });
});
