/**
 * Sobe o wppconnect-server em modo dev (tsx watch).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, "server");

if (!fs.existsSync(path.join(serverDir, "package.json"))) {
  console.error("WPPConnect não instalado. Rode: npm run wppconnect:setup");
  process.exit(1);
}

console.log("[wppconnect] iniciando em http://127.0.0.1:21465");
console.log("[wppconnect] webhook → http://localhost:4000/wppconnect/webhook");
console.log("[wppconnect] Ctrl+C para parar\n");

const child = spawnSync("npm", ["run", "dev"], {
  cwd: serverDir,
  stdio: "inherit",
  shell: true,
});

process.exit(child.status ?? 1);
