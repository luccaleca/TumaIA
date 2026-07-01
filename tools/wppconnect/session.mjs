/**
 * Gera token, fecha sessão zumbi se necessário e inicia WhatsApp.
 * Aguarda check-connection-session = Connected (não confia só em status-session).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metaPath = path.join(__dirname, "tumaia.meta.json");

const meta = fs.existsSync(metaPath)
  ? JSON.parse(fs.readFileSync(metaPath, "utf8"))
  : {
      secretKey: "tumaia-demo-secret",
      session: "tumaia",
      baseUrl: "http://127.0.0.1:21465",
    };

const { secretKey, session, baseUrl } = meta;
const webhookUrl = meta.webhookUrl || "http://localhost:4000/wppconnect/webhook";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(token, pathname, { method = "GET", body } = {}) {
  const url = `${baseUrl}/api/${session}${pathname}`;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, payload };
}

async function isReallyConnected(token) {
  const { payload } = await api(token, "/check-connection-session");
  return payload?.status === true || String(payload?.message || "").toLowerCase() === "connected";
}

async function main() {
  console.log("[wppconnect] gerando token…");
  const tokenRes = await fetch(`${baseUrl}/api/${session}/${secretKey}/generate-token`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const tokenPayload = await tokenRes.json().catch(() => ({}));
  const token =
    (typeof tokenPayload?.token === "string" && tokenPayload.token) ||
    (typeof tokenPayload?.full === "string" && tokenPayload.full) ||
    "";

  if (!tokenRes.ok || !token) {
    console.error("Falha ao gerar token. O servidor WPPConnect está rodando? (npm run wppconnect:dev)");
    console.error(tokenPayload);
    process.exit(1);
  }

  console.log("[wppconnect] token OK");

  if (await isReallyConnected(token)) {
    console.log("[wppconnect] já conectado (check-connection-session = Connected)");
    return;
  }

  console.log("[wppconnect] fechando sessão anterior (se houver)…");
  await api(token, "/close-session", { method: "POST" });
  await sleep(2000);

  console.log("[wppconnect] iniciando sessão…");
  const start = await api(token, "/start-session", {
    method: "POST",
    body: { webhook: webhookUrl },
  });

  if (!start.ok) {
    console.error("Falha ao iniciar sessão:");
    console.error(start.payload);
    process.exit(1);
  }

  console.log(JSON.stringify(start.payload, null, 2));

  console.log("[wppconnect] aguardando conexão real (até ~2 min)…");
  for (let i = 0; i < 40; i++) {
    if (await isReallyConnected(token)) {
      console.log("\n[wppconnect] WhatsApp conectado. Mande uma mensagem para testar a IA.");
      return;
    }
    await sleep(3000);
    process.stdout.write(".");
  }

  console.error(
    "\n[wppconnect] timeout — sessão não ficou ativa. Confira o terminal do wppconnect:dev (QR / erros).",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
