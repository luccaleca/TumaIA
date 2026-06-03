import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildQualityRejectionUserMessage,
  normalizeQualityReviewResult,
} from "../../backend/src/services/imagePreviewQualityReview.js";

describe("image preview quality review", () => {
  it("reprova com issue bloqueante mesmo se approved=true no JSON", () => {
    const r = normalizeQualityReviewResult({
      approved: true,
      score: 90,
      issues: ["produto_muito_grande"],
      summary: "Hero domina o quadro.",
    });
    assert.equal(r.approved, false);
    assert.equal(r.has_blocking_issues, true);
  });

  it("reprova score abaixo do mínimo", () => {
    const r = normalizeQualityReviewResult({
      approved: true,
      score: 50,
      issues: [],
      summary: "ok",
    });
    assert.equal(r.approved, false);
  });

  it("aprova score alto sem issues bloqueantes", () => {
    const r = normalizeQualityReviewResult({
      approved: true,
      score: 82,
      issues: [],
      summary: "Layout equilibrado.",
    });
    assert.equal(r.approved, true);
  });

  it("mensagem ao usuário lista motivos em português", () => {
    const msg = buildQualityRejectionUserMessage(["texto_sobre_produto", "produto_muito_grande"]);
    assert.match(msg, /texto da campanha em cima do produto/i);
    assert.match(msg, /grande\(s\) demais/i);
    assert.match(msg, /não aparece no chat/i);
  });
});
