import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findLatestCaptionMessageId,
  isImageRevisionRequest,
  isPostDeliveryTypedCommand,
  parseCaptionRevisionInstructions,
  parseTypedDeliveryCommand,
  resolveImageUrlForRevision,
} from "../../frontend/lib/chatDeliveryCommands.js";

describe("chatDeliveryCommands", () => {
  it("detecta pedido de alterar imagem com instruções", () => {
    assert.equal(
      isImageRevisionRequest("Quero alterar a imagem: incluir o preço 99,99"),
      true,
    );
    assert.deepEqual(parseTypedDeliveryCommand("Quero alterar a imagem: incluir o preço 99,99"), {
      type: "revise_image",
      instructions: "incluir o preço 99,99",
    });
  });

  it("detecta atalhos digitados dos botões", () => {
    assert.deepEqual(parseTypedDeliveryCommand("Gerar legenda"), { type: "generate_caption" });
    assert.deepEqual(parseTypedDeliveryCommand("Publicar no Instagram"), {
      type: "publish_instagram",
    });
    assert.deepEqual(parseTypedDeliveryCommand("Alterar legenda"), {
      type: "adjust_caption_prompt",
    });
    assert.deepEqual(parseTypedDeliveryCommand("Mudar legenda"), {
      type: "adjust_caption_prompt",
    });
    assert.deepEqual(parseTypedDeliveryCommand("Alterar imagem"), {
      type: "revise_image_prompt",
    });
    assert.equal(
      parseCaptionRevisionInstructions("Quero alterar a legenda: deixar mais curta"),
      "deixar mais curta",
    );
    assert.equal(isPostDeliveryTypedCommand("Gerar legenda"), true);
    assert.equal(isPostDeliveryTypedCommand("gera uma arte"), false);
  });

  it("resolve URL absoluta para revisão", () => {
    assert.equal(
      resolveImageUrlForRevision("https://cdn.example.com/preview.png"),
      "https://cdn.example.com/preview.png",
    );
    assert.equal(
      resolveImageUrlForRevision("/imagens/x.jpg", "http://localhost:3000"),
      "http://localhost:3000/imagens/x.jpg",
    );
  });

  it("encontra mensagem de legenda mais recente", () => {
    const msgs = [
      { id: "1", role: "assistant", image_urls: ["https://x/a.png"], content: "Prévia" },
      { id: "2", role: "user", content: "Gerar legenda" },
      {
        id: "3",
        role: "assistant",
        content: "Texto da legenda\n\n#tag",
        ui_actions: [{ id: "publish_instagram", label: "Publicar no Instagram" }],
      },
    ];
    assert.equal(findLatestCaptionMessageId(msgs), "3");
  });
});
