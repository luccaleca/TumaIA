import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ORIGEM_UPLOAD_CHAT_PREVIEW,
  filterMidiasAcervo,
  isMidiaRowChatPreview,
} from "../../backend/src/modules/empresas/midiaOrigem.js";
import { isPersistableChatPreviewUrl } from "../../backend/src/services/chatPreviewMidia.js";

describe("chatPreviewMidia", () => {
  it("isPersistableChatPreviewUrl aceita http(s) e rejeita paths locais", () => {
    assert.equal(isPersistableChatPreviewUrl("https://replicate.delivery/x.png"), true);
    assert.equal(isPersistableChatPreviewUrl("http://localhost/x.png"), true);
    assert.equal(isPersistableChatPreviewUrl("/imagens/mock.jpg"), false);
    assert.equal(isPersistableChatPreviewUrl(""), false);
  });

  it("filterMidiasAcervo exclui chat_preview", () => {
    const rows = [
      { id_midia: "a", origem_upload: "upload_manual", nome_exibicao: "produto" },
      { id_midia: "b", origem_upload: ORIGEM_UPLOAD_CHAT_PREVIEW, nome_exibicao: "previa" },
    ];
    const out = filterMidiasAcervo(rows);
    assert.equal(out.length, 1);
    assert.equal(out[0].id_midia, "a");
    assert.equal(isMidiaRowChatPreview(rows[1]), true);
  });
});
