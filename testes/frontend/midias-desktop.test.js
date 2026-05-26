import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMidiasBreadcrumbs,
  isMidiasDesktop,
  midiasPastaIdToUi,
  resolveMidiasPastaAtivaId,
} from "../../frontend/lib/midiasDesktop.js";

const DESKTOP = "desktop-uuid";
const FOLDER_A = "folder-a";
const FOLDER_B = "folder-b";

const pastas = [
  { id_pasta: FOLDER_A, id_pasta_pai: DESKTOP, nome: "Campanha" },
  { id_pasta: FOLDER_B, id_pasta_pai: FOLDER_A, nome: "Fotos" },
];

describe("midiasDesktop", () => {
  it("área de trabalho = pasta upload raiz ou UI vazia", () => {
    assert.equal(isMidiasDesktop("", DESKTOP), true);
    assert.equal(isMidiasDesktop(DESKTOP, DESKTOP), true);
    assert.equal(isMidiasDesktop(FOLDER_A, DESKTOP), false);
    assert.equal(resolveMidiasPastaAtivaId("", DESKTOP), DESKTOP);
    assert.equal(resolveMidiasPastaAtivaId(FOLDER_A, DESKTOP), FOLDER_A);
    assert.equal(midiasPastaIdToUi(DESKTOP, DESKTOP), "");
  });

  it("breadcrumb não inclui a área de trabalho", () => {
    assert.deepEqual(buildMidiasBreadcrumbs(pastas, "", DESKTOP), []);
    assert.deepEqual(buildMidiasBreadcrumbs(pastas, FOLDER_A, DESKTOP), [
      { id_pasta: FOLDER_A, id_pasta_pai: DESKTOP, nome: "Campanha" },
    ]);
    assert.deepEqual(buildMidiasBreadcrumbs(pastas, FOLDER_B, DESKTOP), [
      { id_pasta: FOLDER_A, id_pasta_pai: DESKTOP, nome: "Campanha" },
      { id_pasta: FOLDER_B, id_pasta_pai: FOLDER_A, nome: "Fotos" },
    ]);
  });
});
