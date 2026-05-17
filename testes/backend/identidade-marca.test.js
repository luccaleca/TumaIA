import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBrandIdentityBlockForFlux,
  identidadeCompletude,
  isIdentidadeMarcaContexto,
  normalizeHexColor,
  normalizeIdentidadeDados,
  partitionContextosIdentidade,
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
  it("pronto para imagem com cor e estilo", () => {
    const c = identidadeCompletude({
      cor_primaria: "#111111",
      estilo_visual: "limpo",
      tom_voz: "animado",
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
});
