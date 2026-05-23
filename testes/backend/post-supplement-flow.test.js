import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFluxImagePrompt,
  buildRawImagePrompt,
  FLUX_IMAGE_PROMPT_MAX,
} from "../../backend/src/services/imagePreviewPrompt.js";
import { sanitizePostSupplementLinks } from "../../backend/src/services/postContextProposalService.js";

const CTX_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MID_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FAKE = "99999999-9999-4999-8999-999999999999";

describe("post supplement — sanitizePostSupplementLinks", () => {
  const contextoRows = [{ id_contexto_empresa: CTX_ID, nome: "Marco 500k" }];
  const midiaRows = [{ id_midia: MID_ID, nome_exibicao: "Logo marca" }];

  it("mantém só ids que existem no Supabase e monta href do painel", () => {
    const raw = [
      { kind: "contexto", id: CTX_ID, label: "Ver contexto comemorativo" },
      { kind: "midia", id: MID_ID, label: "Ver mídia de referência" },
      { kind: "contexto", id: FAKE, label: "Inventado" },
      { kind: "midia", id: FAKE, label: "Também inventado" },
    ];
    const out = sanitizePostSupplementLinks(raw, contextoRows, midiaRows);
    assert.equal(out.length, 2);
    assert.equal(out[0].kind, "contexto");
    assert.equal(out[0].id, CTX_ID);
    assert.match(out[0].href, new RegExp(`contexto=${CTX_ID}`));
    assert.equal(out[1].kind, "midia");
    assert.equal(out[1].id, MID_ID);
    assert.match(out[1].href, new RegExp(`midia=${MID_ID}`));
  });

  it("ignora kind inválido ou label vazio", () => {
    const out = sanitizePostSupplementLinks(
      [
        { kind: "contexto", id: CTX_ID, label: "" },
        { kind: "outro", id: CTX_ID, label: "x" },
      ],
      contextoRows,
      midiaRows,
    );
    assert.equal(out.length, 0);
  });
});

describe("post supplement — buildFluxImagePrompt com proposta", () => {
  it("inclui bloco de alinhamento confirmado e respeita teto de caracteres", () => {
    const proposal = {
      intent_summary: "Post 500k seguidores",
      facts_for_image: { seguidores: "500k" },
    };
    const prompt = buildFluxImagePrompt({
      history: [{ role: "user", content: "Quero um post comemorando 500 mil seguidores." }],
      contextoRows: [
        {
          nome: "Identidade da marca",
          schema_json: { tipo: "identidade_marca" },
          dados_json: {
            tipo: "identidade_marca",
            cor_primaria: "#00B341",
            estilo_visual: "limpo, premium",
            tom_voz: "confiante",
          },
        },
        { id_contexto_empresa: CTX_ID, nome: "Data comemorativa", dados_json: { tipo: "data_comemorativa" } },
      ],
      postContextProposal: proposal,
    });
    assert.match(prompt, /500k seguidores/i);
    assert.doesNotMatch(prompt, /Brand identity|Client request/i);
    assert.ok(prompt.length < 400, "pipeline raw = só pedido");
  });

  it("buildRawImagePrompt repete intent_summary", () => {
    const p = buildRawImagePrompt(
      [{ role: "user", content: "Post planos TumaIA" }],
      { intent_summary: "Post planos Starter Pro Business" },
    );
    assert.equal(p, "Post planos Starter Pro Business");
  });

  it("modo full ainda monta seções longas", () => {
    const prompt = buildFluxImagePrompt({
      history: [{ role: "user", content: "Post institucional" }],
      contextoRows: [],
      postContextProposal: { intent_summary: "Post institucional" },
      pipeline: "standard",
      promptStyle: "full",
      postContextProposal: { intent_summary: "Post institucional" },
    });
    assert.match(prompt, /Client request/);
    assert.match(prompt, /Brand identity|Professional marketing/i);
  });
});
