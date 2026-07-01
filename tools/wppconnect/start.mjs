/**
 * Sobe o wppconnect-server em modo dev (tsx watch).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, "server");
const WPPCONNECT_PORT = 21465;

if (!fs.existsSync(path.join(serverDir, "package.json"))) {
  console.error("WPPConnect não instalado. Rode: npm run wppconnect:setup");
  process.exit(1);
}

function portBusy(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(true));
    srv.once("listening", () => {
      srv.close(() => resolve(false));
    });
    srv.listen(port, "127.0.0.1");
  });
}

async function wppconnectAlreadyUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${WPPCONNECT_PORT}/api-docs`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

if (await wppconnectAlreadyUp()) {
  console.log(`[wppconnect] já está rodando em http://127.0.0.1:${WPPCONNECT_PORT}`);
  console.log("[wppconnect] não é preciso iniciar de novo. Se o WhatsApp caiu: npm run whats:session");
  console.log("[wppconnect] para reiniciar o servidor, encerre o processo na porta 21465:");
  console.log(`  netstat -ano | findstr :${WPPCONNECT_PORT}`);
  console.log("  taskkill /PID <pid> /F");
  process.exit(0);
}

const busy = await portBusy(WPPCONNECT_PORT);
if (busy) {
  console.error(`[wppconnect] porta ${WPPCONNECT_PORT} em uso por outro processo.`);
  console.error(`  netstat -ano | findstr :${WPPCONNECT_PORT}`);
  console.error("  taskkill /PID <pid> /F");
  process.exit(1);
}

console.log(`[wppconnect] iniciando em http://127.0.0.1:${WPPCONNECT_PORT}`);
console.log("[wppconnect] webhook → http://localhost:4000/wppconnect/webhook");
console.log("[wppconnect] Ctrl+C para parar\n");

const child = spawnSync("npm", ["run", "dev"], {
  cwd: serverDir,
  stdio: "inherit",
  shell: true,
});

process.exit(child.status ?? 1);
