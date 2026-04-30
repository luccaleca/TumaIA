import { createApp } from "./app.js";
import { env } from "./config.js";

const app = createApp();
const server = app.listen(env.PORT, () => {
  const baseUrl = `http://localhost:${env.PORT}`;
  console.log(`tumaia-backend ${baseUrl}/demo/site/index.html`);
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
  // Encerra sockets abertos de uma vez (libera a porta mais rápido no Windows).
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 4000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
