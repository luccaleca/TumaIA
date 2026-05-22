import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOGO_IDENTIDADE_MIN_LADO_MAIOR_PX,
  ORIGEM_UPLOAD_IDENTIDADE_FOTO,
  ORIGEM_UPLOAD_MANUAL,
  filterMidiasAcervo,
  filterMidiasIdentidade,
  isOrigemUploadIdentidade,
  validateLogoIdentidadeDimensions,
} from "../../backend/src/modules/empresas/midiaOrigem.js";

describe("midiaOrigem", () => {
  it("separa acervo e identidade", () => {
    const rows = [
      { id_midia: "1", origem_upload: ORIGEM_UPLOAD_MANUAL },
      { id_midia: "2", origem_upload: ORIGEM_UPLOAD_IDENTIDADE_FOTO },
    ];
    assert.equal(filterMidiasAcervo(rows).length, 1);
    assert.equal(filterMidiasIdentidade(rows).length, 1);
    assert.equal(isOrigemUploadIdentidade(ORIGEM_UPLOAD_IDENTIDADE_FOTO), true);
    assert.equal(isOrigemUploadIdentidade(ORIGEM_UPLOAD_MANUAL), false);
  });

  it("rejeita logo da identidade abaixo do mínimo", () => {
    const bad = validateLogoIdentidadeDimensions(150, 150);
    assert.equal(bad.ok, false);
    assert.match(bad.error, /150×150/);
    assert.match(bad.error, new RegExp(String(LOGO_IDENTIDADE_MIN_LADO_MAIOR_PX)));

    const ok = validateLogoIdentidadeDimensions(512, 200);
    assert.equal(ok.ok, true);

    const ideal = validateLogoIdentidadeDimensions(1024, 800);
    assert.equal(ideal.ok, true);
  });
});
