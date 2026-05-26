import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isIdentidadePromptLeak,
  mergeBrandPaletteSources,
  sanitizeEstiloVisualText,
  sanitizeIdentidadeLlmOutput,
} from "../../backend/src/modules/empresas/identidadeAnaliseLlm.js";
import {
  formatBrandIdentityBlockForFlux,
  formatBrandIdentityForRawPrompt,
  EVITAR_PADRAO_IMAGEM,
  identidadeCompletude,
  isIdentidadeMarcaContexto,
  normalizeHexColor,
  normalizeIdentidadeDados,
  partitionContextosIdentidade,
  refineIdentidadeFromAnalysis,
} from "../../backend/src/modules/empresas/identidadeMarca.js";
import { rankReferenceMidiaIds } from "../../backend/src/services/referenceMidiaRanking.js";
import { normalizeWebsiteUrl } from "../../backend/src/services/websiteTextExtract.js";

describe("identidadeMarca — normalizeHexColor", () => {
  it("aceita hex 6 dígitos", () => {
    assert.equal(normalizeHexColor("#6b2d9e"), "#6B2D9E");
  });
  it("expande hex 3 dígitos", () => {
    assert.equal(normalizeHexColor("f00"), "#FF0000");
  });
});

describe("identidadeMarca — partition e prompt FLUX", () => {
  it("separa contexto identidade das campanhas", () => {
    const rows = [
      { nome: "Black Friday", schema_json: { tipo: "promocao" }, dados_json: {} },
      {
        nome: "Identidade da marca",
        schema_json: { tipo: "identidade_marca" },
        dados_json: { cor_primaria: "#6B2D9E", estilo_visual: "premium" },
      },
    ];
    const { campanhaRows, identidadeDados } = partitionContextosIdentidade(rows);
    assert.equal(campanhaRows.length, 1);
    assert.equal(identidadeDados?.cor_primaria, "#6B2D9E");
  });

  it("formatBrandIdentityForRawPrompt inclui cores e estilo", () => {
    const block = formatBrandIdentityForRawPrompt({
      cor_primaria: "#6B2D9E",
      estilo_visual: "ótica premium",
      assinatura_visual: "tipografia condensada, headline dominante, produto central",
      estrategia_cor_campanha: "usar #FFFFFF como base neutra e variar a cor conforme o produto",
      tom_voz: "acolhedor",
    });
    assert.match(block, /Cores da marca/);
    assert.match(block, /#6B2D9E/);
    assert.match(block, /Assinatura visual da marca/);
    assert.match(block, /Estratégia de cor por campanha/);
  });

  it("formatBrandIdentityBlockForFlux inclui cores", () => {
    const block = formatBrandIdentityBlockForFlux({
      cor_primaria: "#6B2D9E",
      cor_secundaria: "#D4AF37",
      estilo_visual: "ótica premium",
    });
    assert.match(block, /#6B2D9E/);
    assert.match(block, /Do NOT copy/i);
  });
});

describe("identidadeMarca — completude", () => {
  it("pronto para imagem com cor, estilo e evitar", () => {
    const c = identidadeCompletude({
      cor_primaria: "#111111",
      estilo_visual: "limpo",
      evitar: "clipart",
    });
    assert.equal(c.pronto_para_imagem, true);
  });

  it("pronto para imagem com cor, estilo e logo", () => {
    const c = identidadeCompletude({
      cor_primaria: "#111111",
      estilo_visual: "limpo",
      id_midia_logo: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    assert.equal(c.pronto_para_imagem, true);
  });
});

describe("identidadeMarca — isIdentidadeMarcaContexto", () => {
  it("detecta por schema tipo", () => {
    assert.equal(isIdentidadeMarcaContexto({ schema_json: { tipo: "identidade_marca" } }), true);
  });
});

describe("referenceMidiaRanking — excludeIds", () => {
  it("remove id de post de identidade da fila", () => {
    const idPost = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const idProd = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const rows = [
      {
        id_midia: idPost,
        nome_exibicao: "Post 500k feed",
        tipo_midia: "imagem",
        extensao: ".png",
      },
      {
        id_midia: idProd,
        nome_exibicao: "oculos recorte png",
        tipo_midia: "imagem",
        extensao: ".png",
      },
    ];
    const ranked = rankReferenceMidiaIds([idPost, idProd], rows, "", [idPost]);
    assert.deepEqual(ranked, [idProd]);
  });
});

describe("websiteTextExtract — normalizeWebsiteUrl", () => {
  it("adiciona https se faltar", () => {
    const u = normalizeWebsiteUrl("exemplo.com.br");
    assert.ok(u?.startsWith("https://"));
  });
  it("rejeita localhost", () => {
    assert.equal(normalizeWebsiteUrl("http://localhost:3000"), null);
  });
});

describe("identidadeMarca — normalizeIdentidadeDados", () => {
  it("normaliza tom_voz array", () => {
    const d = normalizeIdentidadeDados({ tom_voz: ["animado", "premium"] });
    assert.equal(d.tom_voz, "animado, premium");
  });

  it("preserva id_midia_logo", () => {
    const id = "cccccccc-cccc-4ccc-accc-cccccccccccc";
    const d = normalizeIdentidadeDados({ id_midia_logo: id });
    assert.equal(d.id_midia_logo, id);
  });

  it("normaliza campos de padrão visual", () => {
    const d = normalizeIdentidadeDados({
      assinatura_visual: "  tipografia condensada   \n produto central ",
      variacoes_campanha: " cor por produto ; CTA ocasional ",
      regras_repeticao: " logo no topo ; headline curta ",
      estrategia_cor_campanha: " usar #FFFFFF como base e variar a cor dominante conforme o produto ",
    });
    assert.equal(d.assinatura_visual, "tipografia condensada produto central");
    assert.equal(d.variacoes_campanha, "cor por produto ; CTA ocasional");
    assert.equal(d.regras_repeticao, "logo no topo ; headline curta");
    assert.match(d.estrategia_cor_campanha, /#FFFFFF/);
  });
});

describe("identidadeMarca — refineIdentidadeFromAnalysis", () => {
  it("aplica paleta e normaliza tom_voz", () => {
    const d = refineIdentidadeFromAnalysis(
      { tom_voz: "animado; premium; direto", estilo_visual: "Limpo e moderno" },
      { primary: "#E31B23", secondary: "#1A1A1A" },
    );
    assert.equal(d.cor_primaria, "#E31B23");
    assert.equal(d.cor_secundaria, "#1A1A1A");
    assert.equal(d.tom_voz, "animado, premium, direto");
    assert.equal(d.estilo_visual, "Limpo e moderno");
    assert.equal(d.cor_primaria, "#E31B23");
  });

  it("prioriza cores_marca da visão sobre marrom de pixels", () => {
    const d = refineIdentidadeFromAnalysis(
      {
        cores_marca: ["#14AE46", "#FFFFFF", "#0F1829", "#5EEAD4"],
        estilo_visual: "Limpo, tech, premium",
      },
      {
        primary: "#2B1104",
        secondary: "#3E210E",
        accents: ["#C4A574"],
      },
    );
    assert.equal(d.cor_primaria, "#14AE46");
    assert.ok(d.cores_adicionais.includes("#FFFFFF") || d.cor_secundaria === "#FFFFFF");
    assert.ok(!d.cor_primaria.includes("2B1104"));
  });

  it("remove vazamento de instruções do prompt em evitar", () => {
    const leak =
      "cores de pele, pelo, mascote ilustrado — não confunda com a paleta da marca. Priorize cores de interface.";
    const cleaned = sanitizeIdentidadeLlmOutput({ evitar: leak, estilo_visual: "premium" });
    assert.equal(cleaned.evitar, "");
    assert.equal(isIdentidadePromptLeak(leak), true);
    const d = refineIdentidadeFromAnalysis(cleaned, null);
    assert.equal(d.evitar, EVITAR_PADRAO_IMAGEM);
  });

  it("guarda cores adicionais da paleta extraída", () => {
    const d = refineIdentidadeFromAnalysis(
      { estilo_visual: "Tech e premium" },
      {
        primary: "#00E676",
        secondary: "#0F172A",
        accents: ["#FFFFFF", "#94A3B8", "#C4A574"],
      },
    );
    assert.equal(d.cor_primaria, "#00E676");
    assert.equal(d.cor_secundaria, "#0F172A");
    assert.equal(d.cores_adicionais.length, 3);
    assert.ok(d.cores_adicionais.includes("#FFFFFF"));
  });
});

describe("identidadeAnaliseLlm — sanitizeEstiloVisualText", () => {
  it("remove hex e nomes de cor", () => {
    const s = sanitizeEstiloVisualText(
      "Limpo, verde e azul, premium. Paleta: #14AE46, #0F1829.",
    );
    assert.equal(s, "Limpo, premium");
  });
});

describe("identidadeAnaliseLlm — mergeBrandPaletteSources", () => {
  it("pondera visão acima de pixels", () => {
    const p = mergeBrandPaletteSources({
      vision: ["#14AE46"],
      pixels: ["#2B1104", "#3E210E"],
    });
    assert.equal(p.cor_primaria, "#14AE46");
  });
});
