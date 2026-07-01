/**
 * Para serviços locais e apaga sessão WPPConnect (tokens + perfil Chrome).
 * Uso: npm run dev:reset
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const wppDir = path.join(root, "tools", "wppconnect", "server");
const metaPath = path.join(root, "tools", "wppconnect", "tumaia.meta.json");

const PORTS = [3000, 4000, 21465];
const SESSION = "tumaia";

function readMeta() {
  if (!fs.existsSync(metaPath)) {
    return { secretKey: "tumaia-demo-secret", session: SESSION, baseUrl: "http://127.0.0.1:21465" };
  }
  return JSON.parse(fs.readFileSync(metaPath, "utf8"));
}

function pidsOnPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid) && pid !== "0") pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killPort(port) {
  const pids = pidsOnPort(port);
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`  encerrado PID ${pid} (porta ${port})`);
    } catch {
      console.warn(`  não foi possível encerrar PID ${pid} na porta ${port}`);
    }
  }
  if (!pids.length) console.log(`  porta ${port} livre`);
}

async function closeWppSessionIfUp() {
  const meta = readMeta();
  const base = String(meta.baseUrl || "http://127.0.0.1:21465").replace(/\/$/, "");
  const session = meta.session || SESSION;
  const secret = meta.secretKey || "tumaia-demo-secret";
  try {
    const tokenRes = await fetch(`${base}/api/${session}/${secret}/generate-token`, {
      method: "POST",
      signal: AbortSignal.timeout(3000),
    });
    if (!tokenRes.ok) return;
    const tokenPayload = await tokenRes.json().catch(() => ({}));
    const token = tokenPayload?.token || tokenPayload?.full;
    if (!token) return;
    await fetch(`${base}/api/${session}/close-session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    console.log("  sessão WPPConnect fechada via API");
  } catch {
    /* servidor já parado */
  }
}

function rmDir(dir) {
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  return true;
}

function rmFile(file) {
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

async function main() {
  console.log("[reset] parando serviços locais…\n");
  await closeWppSessionIfUp();
  for (const port of PORTS) killPort(port);

  console.log("\n[reset] apagando dados da sessão WhatsApp…\n");

  const userData = path.join(wppDir, "userDataDir", SESSION);
  if (rmDir(userData)) console.log(`  removido ${path.relative(root, userData)}`);
  else console.log(`  userDataDir/${SESSION} já ausente`);

  const tokensDir = path.join(wppDir, "tokens");
  if (fs.existsSync(tokensDir)) {
    for (const name of fs.readdirSync(tokensDir)) {
      if (name.startsWith(`${SESSION}.`) || name === `${SESSION}.data.json`) {
        const f = path.join(tokensDir, name);
        if (rmFile(f)) console.log(`  removido ${path.relative(root, f)}`);
      }
    }
  }

  const logFile = path.join(wppDir, "log", "app.logg");
  if (rmFile(logFile)) console.log(`  removido log do wppconnect`);

  console.log("\n[reset] pronto — ambiente zerado.\n");
  console.log("Próximos passos:");
  console.log("  1. Reative o Supabase no dashboard (se estiver pausado)");
  console.log("  2. npm run dev:mono          (site + backend + WhatsApp)");
  console.log("  3. npm run whats:session     (se precisar escanear QR de novo)");
  console.log("  4. No navegador: logout/login e limpe localStorage se quiser rascunho de chat zerado");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
