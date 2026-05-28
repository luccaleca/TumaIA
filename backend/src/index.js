import { createApp } from "./app.js";
import { env } from "./config.js";
import { ensureChatWorkerReady, shutdownChatWorker } from "./services/chatPythonWorker.js";

const app = createApp();

const imageProvider = env.IMAGE_PROVIDER || "replicate";
if (imageProvider === "openai") {
  if (!env.OPENAI_API_KEY) {
    console.warn("[openai-image] OPENAI_API_KEY ausente — /ia/image-preview retornará 503.");
  } else if (!env.OPENAI_ALLOW_BILLING) {
    console.warn("[openai-image] Defina OPENAI_ALLOW_BILLING=true.");
  }
} else if (!env.REPLICATE_API_TOKEN) {
  console.warn("[replicate] REPLICATE_API_TOKEN ausente — use o token de replicate.com/openai/gpt-image-2");
} else if (!env.REPLICATE_ALLOW_BILLING) {
  console.warn("[replicate] Defina REPLICATE_ALLOW_BILLING=true para gerar imagens.");
} else if (imageProvider === "replicate") {
  console.info("[image] Replicate openai/gpt-image-2 (REPLICATE_API_TOKEN)");
}
if (env.IMAGE_PIPELINE === "raw") {
  console.info("[image] IMAGE_PIPELINE=raw — prompt de imagem = só pedido do usuário; proposta sem Llama.");
}

const server = app.listen(env.PORT, () => {
  const baseUrl = `http://localhost:${env.PORT}`;
  console.log(`tumaia-backend ${baseUrl}`);
  // Primeira mensagem do chat não paga sozinha o boot do Python + Chroma.
  ensureChatWorkerReady().catch((err) =>
    console.warn(
      "[chat-worker] warm-up (subirá na 1ª mensagem se falhar):",
      err instanceof Error ? err.message : err,
    ),
  );
  console.info(
    `[chat-worker] timeouts boot=${Math.round(env.CHAT_WORKER_BOOT_TIMEOUT_MS / 1000)}s request=${Math.round(env.CHAT_WORKER_REQUEST_TIMEOUT_MS / 1000)}s`,
  );
});

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.error(
      `Porta ${env.PORT} em uso. No .env use outra PORT ou encerre o processo:\n` +
        `  netstat -ano | findstr :${env.PORT}\n` +
        `  taskkill /PID <pid> /F`
    );
    process.exit(1);
  }
  throw err;
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    process.exit(1);
    return;
  }
  shuttingDown = true;
  console.log(`\n${signal}, encerrando servidor...`);
  shutdownChatWorker();
  // Encerra sockets abertos de uma vez (libera a porta mais rápido no Windows).
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 4000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
