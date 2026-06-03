import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyLlmFailureMitigations,
  applySentenceFailureFilters,
  stripSycophancyOpeners,
} from "../../backend/src/services/chatLlmFailurePatterns.js";

describe("chatLlmFailurePatterns", () => {
  it("stripSycophancyOpeners remove abertura bajuladora", () => {
    assert.equal(
      stripSycophancyOpeners("Com certeza! Temos Monster."),
      "Temos Monster.",
    );
  });

  it("remove sentença de ferramenta fantasma", () => {
    const out = applySentenceFailureFilters(
      "Consultei o Supabase. Temos whey.",
      { question: "produtos" },
    );
    assert.doesNotMatch(out, /Supabase/i);
    assert.match(out, /whey/i);
  });

  it("detecta drift para inglês", () => {
    const out = applyLlmFailureMitigations("As an AI I can help you.", {
      question: "quais produtos temos?",
    });
    assert.match(out, /portugu[eê]s/i);
  });
});
