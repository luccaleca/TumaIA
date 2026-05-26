import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectMediaFilesFromFileList,
  folderPathFromRelativeFile,
  guessMediaMimeType,
  inferTipoMidia,
  isUploadableMediaFile,
} from "../../frontend/lib/collectDroppedMediaFiles.js";

describe("collectDroppedMediaFiles", () => {
  it("detecta mídia por mime e extensão", () => {
    assert.equal(isUploadableMediaFile({ type: "image/png", name: "a.png" }), true);
    assert.equal(isUploadableMediaFile({ type: "", name: "clip.MP4" }), true);
    assert.equal(isUploadableMediaFile({ type: "application/pdf", name: "doc.pdf" }), false);
  });

  it("extrai caminho de pasta do webkitRelativePath", () => {
    assert.deepEqual(folderPathFromRelativeFile({ webkitRelativePath: "Campanha/foto.jpg" }), ["Campanha"]);
    assert.deepEqual(folderPathFromRelativeFile({ webkitRelativePath: "a/b/c.png" }), ["a", "b"]);
    assert.deepEqual(folderPathFromRelativeFile({ webkitRelativePath: "solo.webp" }), []);
  });

  it("infere mime e tipo quando o browser não preenche file.type", () => {
    const file = { type: "", name: "foto.HEIC" };
    assert.equal(guessMediaMimeType(file), "image/heic");
    assert.equal(inferTipoMidia(file), "imagem");
  });

  it("filtra lista de arquivos para upload", () => {
    const entries = collectMediaFilesFromFileList([
      { type: "image/jpeg", name: "ok.jpg", webkitRelativePath: "Pasta/ok.jpg" },
      { type: "application/pdf", name: "skip.pdf", webkitRelativePath: "Pasta/skip.pdf" },
    ]);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].file.name, "ok.jpg");
    assert.deepEqual(entries[0].folderPath, ["Pasta"]);
  });
});
