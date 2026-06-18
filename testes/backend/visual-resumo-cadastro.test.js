import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeAmbienteFromCadastro } from "../../backend/src/services/visualResumoFromCadastro.js";
import {
  formatProductDisplayName,
  intentLooksPromotional,
  isMeaningfulCadastroValue,
} from "../../backend/src/services/cadastroMeaningful.js";
import { synthesizeResumoVisual } from "../../backend/src/services/imageHeadline.js";

describe("visual resumo a partir do cadastro", () => {
  it("pet shop usa segmento e metadados da mídia, não lista fixa de produtos", () => {
    const ambiente = describeAmbienteFromCadastro(
      { segmento: "Pet shop", descricao: "Loja para cães e gatos" },
      { publico: "tutores de pets", estilo_visual: "colorido e acolhedor" },
      [
        {
          nome_exibicao: "Ração Premium",
          descricao: "Saco de ração para cães adultos, saco amarelo",
        },
      ],
    );
    assert.match(ambiente, /Pet shop/i);
    assert.match(ambiente, /Ração Premium|ração/i);
    assert.match(ambiente, /tutores de pets/i);
    assert.doesNotMatch(ambiente, /grãos de café|fitness/i);
  });

  it("synthesizeResumoVisual incorpora cadastro da empresa no fallback", () => {
    const resumo = synthesizeResumoVisual(
      {
        intent_summary: "post de lançamento da ração premium por R$ 89,90",
        matched_contexto: { nome: "Lançamento" },
        midias_referenced: [
          {
            nome_exibicao: "Ração Premium",
            descricao: "Saco 15kg para cães",
          },
        ],
        hero_product: { nome_exibicao: "Ração Premium" },
      },
      "post de lançamento da ração premium por R$ 89,90",
      {
        empresaRow: { segmento: "Pet shop", nome_fantasia: "Pet Amigo" },
        identidadeDados: { estilo_visual: "familiar e confiável" },
      },
    );
    assert.match(resumo, /centralizado/i);
    assert.match(resumo, /Pet shop|Ração|89/i);
  });

  it("promoção no pedido vence modelo Lançamento e ignora placeholders de cadastro", () => {
    assert.equal(
      isMeaningfulCadastroValue("segmento", "Categoria"),
      false,
    );
    assert.equal(
      isMeaningfulCadastroValue("publico", "Público-alvo"),
      false,
    );
    assert.equal(formatProductDisplayName("monster.png"), "Monster");
    assert.equal(
      intentLooksPromotional("post de monster de promoção de 12,99 por 8,99"),
      true,
    );
    const resumo = synthesizeResumoVisual(
      {
        intent_summary: "quero um post de monster de promoção de 12,99 por 8,99",
        matched_contexto: { nome: "Lançamento" },
        midias_referenced: [
          {
            nome_exibicao: "monster.png",
            why: "PNG do acervo selecionado conforme o pedido.",
          },
        ],
        hero_product: { nome_exibicao: "monster.png" },
      },
      "quero um post de monster de promoção de 12,99 por 8,99",
      {
        empresaRow: { segmento: "Categoria" },
        identidadeDados: { publico: "Público-alvo", estilo_visual: "Limpo e moderno" },
      },
    );
    assert.match(resumo, /Post promocional/i);
    assert.doesNotMatch(resumo, /lançamento/i);
    assert.match(resumo, /Monster/);
    assert.doesNotMatch(resumo, /monster\.png/i);
    assert.doesNotMatch(resumo, /negócio de Categoria/i);
    assert.doesNotMatch(resumo, /Público-alvo\./i);
    assert.doesNotMatch(resumo, /PNG do acervo selecionado/i);
  });
});
