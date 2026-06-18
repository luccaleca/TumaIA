/**
 * Gera token e inicia sessão WhatsApp (exibe instruções + QR no terminal do server).
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

async function main() {
  const tokenUrl = `${baseUrl}/api/${session}/${secretKey}/generate-token`;
  console.log("[wppconnect] gerando token…");
  const tokenRes = await fetch(tokenUrl, { method: "POST", headers: { Accept: "application/json" } });
  const tokenPayload = await tokenRes.json().catch(() => ({}));
  const token =
    (typeof tokenPayload?.token === "string" && tokenPayload.token) ||
    (typeof tokenPayload?.full === "string" && tokenPayload.full) ||
    "";

  if (!tokenRes.ok || !token) {
    console.error("Falha ao gerar token. O servidor WPPConnect está rodando?");
    console.error(tokenPayload);
    process.exit(1);
  }

  console.log("[wppconnect] token OK\n");

  const startUrl = `${baseUrl}/api/${session}/start-session`;
  console.log("[wppconnect] iniciando sessão (QR no terminal do wppconnect:dev)…");
  const startRes = await fetch(startUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ webhook: meta.webhookUrl || "http://localhost:4000/wppconnect/webhook" }),
  });
  const startPayload = await startRes.json().catch(() => ({}));

  if (!startRes.ok) {
    console.error("Falha ao iniciar sessão:");
    console.error(startPayload);
    process.exit(1);
  }

  console.log(JSON.stringify(startPayload, null, 2));
  console.log("\n[wppconnect] Escaneie o QR Code no terminal onde roda `npm run wppconnect:dev`.");
  console.log("[wppconnect] Com backend ativo, mande uma mensagem no WhatsApp para testar a IA.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
