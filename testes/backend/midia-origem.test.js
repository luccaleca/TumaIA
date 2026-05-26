import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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

  it("aceita logo da identidade em qualquer tamanho legível (mínimo 512 desativado)", () => {
    assert.equal(validateLogoIdentidadeDimensions(150, 150).ok, true);
    assert.equal(validateLogoIdentidadeDimensions(1024, 800).ok, true);

    const invalid = validateLogoIdentidadeDimensions(0, 100);
    assert.equal(invalid.ok, false);
    assert.match(invalid.error, /tamanho/i);
  });
});
