import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { wantsLogoAsHero } from "../../backend/src/services/logoReferencePolicy.js";

describe("logoReferencePolicy", () => {
  it("não trata menção casual a logo como protagonista", () => {
    assert.equal(wantsLogoAsHero("arte black friday com whey e logo no canto"), false);
    assert.equal(wantsLogoAsHero("monta post com produto do acervo"), false);
  });

  it("detecta pedido explícito de logo em destaque", () => {
    assert.equal(wantsLogoAsHero("quero o logo em destaque no post"), true);
    assert.equal(wantsLogoAsHero("arte só o logo da FYT como protagonista"), true);
    assert.equal(wantsLogoAsHero("foco na logo, sem produto"), true);
  });
});
