import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBriefingGate,
  detectFilledSlots,
  listMissingBriefingSlots,
} from "../../backend/src/services/postBriefingSlots.js";

describe("postBriefingSlots", () => {
  it("detecta pedido seco de promo com lacunas", () => {
    const history = [{ role: "user", content: "Quero um post de promoção dia dos namorados" }];
    const missing = listMissingBriefingSlots(history);
    assert.ok(missing.includes("produto"));
    assert.ok(missing.includes("beneficio"));
    assert.ok(missing.includes("periodo"));
  });

  it("pedido completo fica pronto para confirmar", () => {
    const history = [
      {
        role: "user",
        content:
          "Post promo Dia dos Namorados, kit chocolate 20% off de 10/06 a 14/06, frase «Presenteie quem ama»",
      },
    ];
    const missing = listMissingBriefingSlots(history);
    assert.equal(missing.length, 0);

    const gated = applyBriefingGate(history, {
      confirmation_message: "Confira o resumo do seu pedido para Namorados.",
      post_context_proposal: { intent_summary: "promo namorados" },
      links: [],
    });
    assert.equal(gated.briefing_status, "ready");
  });

  it("modo collecting gera perguntas e não confirma", () => {
    const history = [{ role: "user", content: "Monta um post de promoção" }];
    const gated = applyBriefingGate(history, {
      confirmation_message: "Confira o resumo.",
      post_context_proposal: {},
      links: [],
    });
    assert.equal(gated.briefing_status, "collecting");
    assert.ok(gated.missing_slots.length > 0);
    assert.match(gated.confirmation_message, /detalhes|produto|benefício|período/i);
  });

  it("aceita sem produto institucional", () => {
    const filled = detectFilledSlots("promo dia dos namorados sem produto, 15% até 12/06, frase «Amor»");
    assert.equal(filled.produto, true);
    assert.equal(filled.beneficio, true);
    assert.equal(filled.periodo, true);
    assert.equal(filled.frase_imagem, true);
  });
});
