import { createApp } from "./app.js";
import { env } from "./config.js";
import { ensureChatWorkerReady, shutdownChatWorker } from "./services/chatPythonWorker.js";

const app = createApp();

if (env.REPLICATE_API_TOKEN && !env.REPLICATE_ALLOW_BILLING) {
  console.warn(
    "[replicate] REPLICATE_API_TOKEN está definido, mas REPLICATE_ALLOW_BILLING não está ativo — nenhuma rota de imagem debitará até você definir REPLICATE_ALLOW_BILLING=true.",
  );
}
if (env.REPLICATE_ALLOW_BILLING && env.REPLICATE_DAILY_SUCCESS_CAP === 0) {
  console.warn(
    "[replicate] REPLICATE_DAILY_SUCCESS_CAP=0 — sem teto diário de gerações com sucesso; monitore o painel da Replicate.",
  );
}

const server = app.listen(env.PORT, () => {
  const baseUrl = `http://localhost:${env.PORT}`;
  console.log(`tumaia-backend ${baseUrl}`);
  // Primeira mensagem do chat não paga sozinha o boot do Python + Chroma.
  ensureChatWorkerReady().catch((err) =>
    console.warn("[chat-worker] warm-up (subirá na 1ª mensagem):", err instanceof Error ? err.message : err),
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
