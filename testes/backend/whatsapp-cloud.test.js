import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../../backend/src/app.js";
import { parseWhatsappCloudWebhookMessages } from "../../backend/src/services/whatsappCloudWebhookParser.js";

describe("whatsappCloudWebhookParser", () => {
  it("extrai texto de payload Cloud API", () => {
    const msgs = parseWhatsappCloudWebhookMessages({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "15550001111",
                  phone_number_id: "1207734229086450",
                },
                contacts: [{ profile: { name: "Cliente" }, wa_id: "5511999887766" }],
                messages: [
                  {
                    from: "5511999887766",
                    id: "wamid.TEST",
                    timestamp: "1710000000",
                    type: "text",
                    text: { body: "quero um post" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].from, "5511999887766");
    assert.equal(msgs[0].body, "quero um post");
    assert.equal(msgs[0].message_id, "wamid.TEST");
    assert.equal(msgs[0].phone_number_id, "1207734229086450");
    assert.equal(msgs[0].contact_name, "Cliente");
  });

  it("ignora payloads sem texto", () => {
    assert.deepEqual(
      parseWhatsappCloudWebhookMessages({
        object: "whatsapp_business_account",
        entry: [{ changes: [{ field: "messages", value: { statuses: [] } }] }],
      }),
      [],
    );
  });
});

describe("HTTP /whatsapp/cloud", () => {
  const app = createApp();
  const cloudEnabled = process.env.WHATSAPP_CLOUD_ENABLED === "true";

  it("GET /status reflete WHATSAPP_CLOUD_ENABLED", async () => {
    const res = await request(app).get("/whatsapp/cloud/status");
    assert.equal(res.status, 200);
    assert.equal(res.body.enabled, cloudEnabled);
  });

  it("GET /webhook valida verify_token e devolve challenge", async () => {
    const token = process.env.WHATSAPP_CLOUD_VERIFY_TOKEN || "";
    const res = await request(app)
      .get("/whatsapp/cloud/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": token || "wrong",
        "hub.challenge": "12345challenge",
      });
    if (token) {
      assert.equal(res.status, 200);
      assert.equal(res.text, "12345challenge");
    } else {
      assert.equal(res.status, 403);
    }
  });

  it("POST /webhook responde conforme WHATSAPP_CLOUD_ENABLED", async () => {
    const res = await request(app)
      .post("/whatsapp/cloud/webhook")
      .send({
        object: "whatsapp_business_account",
        entry: [],
      });
    assert.equal(res.status, cloudEnabled ? 200 : 503);
  });
});
