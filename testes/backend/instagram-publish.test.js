import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { publicUrlForStoragePath } from "../../backend/src/services/chatGeneratedImageStorage.js";
import { env } from "../../backend/src/config.js";
import { publishToInstagram } from "../../backend/src/services/instagramPublishService.js";

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

describe("publishToInstagram", () => {
  const originalFetch = globalThis.fetch;
  const originalToken = env.INSTAGRAM_GRAPH_ACCESS_TOKEN;
  const originalAccount = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  beforeEach(() => {
    env.INSTAGRAM_GRAPH_ACCESS_TOKEN = "token-teste";
    env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "ig_user_1";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    env.INSTAGRAM_GRAPH_ACCESS_TOKEN = originalToken;
    env.INSTAGRAM_BUSINESS_ACCOUNT_ID = originalAccount;
  });

  it("cria container, aguarda FINISHED e publica via Meta Graph", async () => {
    /** @type {{ url: string, init?: RequestInit }[]} */
    const calls = [];
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      calls.push({ url: u, init });
      let body = {};
      if (u.endsWith("/ig_user_1/media")) body = { id: "creation_1" };
      else if (u.includes("/creation_1?")) body = { status_code: "FINISHED" };
      else if (u.endsWith("/ig_user_1/media_publish")) body = { id: "ig_123" };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const out = await publishToInstagram(mockDb(), {
      idEmpresa: EMPRESA,
      caption: "Legenda do post",
      imageStoragePath: `${EMPRESA}/_chat/c/img.png`,
    });

    assert.equal(out.ok, true);
    assert.equal(out.instagram_media_id, "ig_123");
    assert.equal(calls.length, 3);
    const createBody = new URLSearchParams(String(calls[0].init?.body));
    assert.equal(createBody.get("caption"), "Legenda do post");
    assert.ok(createBody.get("image_url")?.startsWith("http"));
    const publishBody = new URLSearchParams(String(calls[2].init?.body));
    assert.equal(publishBody.get("creation_id"), "creation_1");
  });

  it("sem credenciais retorna 503 sem chamar a Graph API", async () => {
    env.INSTAGRAM_GRAPH_ACCESS_TOKEN = "";
    env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "";
    const prevToken = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN;
    const prevAccount = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    delete process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN;
    delete process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response("{}");
    };
    try {
      const out = await publishToInstagram(mockDb(), {
        idEmpresa: EMPRESA,
        caption: "x",
        imageStoragePath: `${EMPRESA}/a.png`,
      });
      assert.equal(out.ok, false);
      assert.equal(out.status, 503);
      assert.equal(called, false);
    } finally {
      if (prevToken !== undefined) process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN = prevToken;
      if (prevAccount !== undefined) process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = prevAccount;
    }
  });
});
