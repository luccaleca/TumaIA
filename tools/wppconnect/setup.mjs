/**
 * Clona wppconnect-server (se faltar), aplica config TumaIA e instala dependências.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, "server");
const repo = "https://github.com/wppconnect-team/wppconnect-server.git";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!fs.existsSync(serverDir)) {
  console.log("[wppconnect] clonando wppconnect-server…");
  run("git", ["clone", "--depth", "1", repo, serverDir]);
} else {
  console.log("[wppconnect] pasta server/ já existe — pulando clone");
}

run("node", [path.join(__dirname, "apply-config.mjs")]);

console.log("[wppconnect] npm install (pode demorar alguns minutos)…");
run("npm", ["install"], { cwd: serverDir });

console.log("\n[wppconnect] setup concluído.");
console.log("Próximo: npm run wppconnect:dev");
console.log("Depois:  npm run wppconnect:session");
