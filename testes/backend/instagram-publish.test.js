import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { publicUrlForStoragePath } from "../../backend/src/services/chatGeneratedImageStorage.js";
import { publishToInstagramViaN8n } from "../../backend/src/services/instagramPublishService.js";

const EMPRESA = "11111111-1111-4111-8111-111111111111";

function mockDb(publicUrl = "https://example.supabase.co/storage/v1/object/public/midias/a.png") {
  return {
    storage: {
      from: () => ({
        getPublicUrl: (path) => ({ data: { publicUrl: `${publicUrl}?path=${encodeURIComponent(path)}` } }),
        upload: async () => ({ error: null }),
      }),
    },
  };
}

describe("publicUrlForStoragePath", () => {
  it("monta URL pública do bucket", () => {
    const url = publicUrlForStoragePath(mockDb(), `${EMPRESA}/_chat/conv/a.png`);
    assert.ok(url?.includes("/object/public/midias/"));
  });
});

describe("publishToInstagramViaN8n", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.N8N_INSTAGRAM_WEBHOOK_URL;

  beforeEach(() => {
    process.env.N8N_INSTAGRAM_WEBHOOK_URL = "https://n8n.test/webhook/instagram-post";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) delete process.env.N8N_INSTAGRAM_WEBHOOK_URL;
    else process.env.N8N_INSTAGRAM_WEBHOOK_URL = originalEnv;
  });

  it("envia image_url e caption para o n8n", async () => {
    /** @type {RequestInit | undefined} */
    let seenInit;
    globalThis.fetch = async (_url, init) => {
      seenInit = init;
      return new Response(
        JSON.stringify({ success: true, message: "ok", instagram_media_id: "ig_123" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const out = await publishToInstagramViaN8n(mockDb(), {
      idEmpresa: EMPRESA,
      caption: "Legenda do post",
      imageStoragePath: `${EMPRESA}/_chat/c/img.png`,
      clientId: "tumaia",
    });

    assert.equal(out.ok, true);
    assert.equal(out.instagram_media_id, "ig_123");
    const body = JSON.parse(String(seenInit?.body));
    assert.equal(body.caption, "Legenda do post");
    assert.equal(body.client_id, "tumaia");
    assert.ok(body.image_url.startsWith("http"));
  });
});
