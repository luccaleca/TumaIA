import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectFormatPresetFromText } from "../../backend/src/services/arteFormatPresets.js";
import {
  buildArteBriefFromHistory,
  promptFromArteBrief,
  aspectRatioFromArteBrief,
} from "../../backend/src/services/rawImageArteBrief.js";

describe("rawImageArteBrief", () => {
  it("detecta stories no texto", () => {
    const p = detectFormatPresetFromText("quero um stories 9:16 para instagram");
    assert.equal(p.id, "stories");
  });

  it("monta brief com tema e formato do histórico", () => {
    const history = [
      {
        role: "user",
        content:
          "Post quadrado 1080x1080 instagram planos PRO e Business, frase: TumaIA entende seu negócio",
      },
    ];
    const brief = buildArteBriefFromHistory(history, ["#00B341", "#0F172A"]);
    assert.match(brief.tema, /planos|PRO|Business/i);
    assert.equal(brief.formato.preset_id, "post_square");
    assert.ok(brief.cores.includes("#00B341"));
    assert.ok(brief.titulo || brief.texto);
  });

  it("não transforma o pedido livre em título sem marcação explícita", () => {
    const brief = buildArteBriefFromHistory(
      [{ role: "user", content: "quero arte black friday do whey com fundo escuro e clima premium" }],
      ["#00B341"],
    );
    assert.equal(brief.titulo, "");
    assert.equal(brief.subtitulo, "");
    assert.equal(brief.texto, "Black Friday");
    assert.match(brief.tema, /black friday|whey/i);
  });

  it("sugere frase promocional no brief mesmo sem `frase:` explícita", () => {
    const brief = buildArteBriefFromHistory(
      [
        {
          role: "user",
          content:
            "quero uma foto das 3 creatinas growth max e integral, com a integral em foco e promoção de 30% de desconto bem em evidência",
        },
      ],
      ["#00B341"],
    );
    assert.equal(brief.titulo, "");
    assert.equal(brief.texto, "Até 30% OFF");
    assert.match(brief.tema, /creatina|promo/i);
  });

  it("prompt estruturado e aspect 4:5 mapeado", () => {
    const brief = buildArteBriefFromHistory(
      [{ role: "user", content: "feed retrato 4:5 promo verão" }],
      [],
    );
    const prompt = promptFromArteBrief(brief);
    assert.match(prompt, /Tema:/i);
    assert.match(prompt, /Formato:/i);
    assert.equal(aspectRatioFromArteBrief(brief), "2:3");
  });
});
