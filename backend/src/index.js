import { createApp } from "./app.js";
import { env } from "./config.js";
import { ensureChatWorkerReady, shutdownChatWorker } from "./services/chatPythonWorker.js";
import { isWppconnectEnabled, ensureWppconnectSession } from "./services/wppconnectClient.js";

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
  if (env.CHAT_LLM_PROVIDER !== "cursor") {
    ensureChatWorkerReady().catch((err) =>
      console.warn(
        "[chat-worker] warm-up (subirá na 1ª mensagem se falhar):",
        err instanceof Error ? err.message : err,
      ),
    );
  }
  console.info(
    `[chat-worker] timeouts boot=${Math.round(env.CHAT_WORKER_BOOT_TIMEOUT_MS / 1000)}s request=${Math.round(env.CHAT_WORKER_REQUEST_TIMEOUT_MS / 1000)}s`,
  );
  if (isWppconnectEnabled()) {
    console.info(
      `[wppconnect] ativo — webhook em http://localhost:${env.PORT}/wppconnect/webhook (sessão: ${env.WPPCONNECT_SESSION})`,
    );
    if (env.TUMAIA_WHATSAPP_FAST_PATH) {
      console.info(
        "[whatsapp] TUMAIA_WHATSAPP_FAST_PATH=true — chat sem Python (regras + Ollama no Node)",
      );
    }
    console.info(
      "[wppconnect] configure webhook.url no wppconnect-server apontando para essa URL",
    );
    ensureWppconnectSession({ force: true }).then((s) => {
      if (s.ok) console.info("[wppconnect] sessão WhatsApp conectada");
      else console.warn("[wppconnect] sessão WhatsApp inativa:", s.error || s.status);
    });
  }
  if (env.CHAT_LLM_PROVIDER === "cursor") {
    console.info(
      `[chat] CHAT_LLM_PROVIDER=cursor — conversa via Cursor Agent (${env.CURSOR_CHAT_MODEL}); Ollama/Python inativos no chat`,
    );
    if (!env.CURSOR_API_KEY) {
      console.warn("[chat] CURSOR_API_KEY ausente — respostas conversacionais vão falhar.");
    }
  }
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
