/**
 * Para serviços locais do TumaIA (backend/frontend).
 * Uso: npm run dev:reset
 */
import { execSync } from "node:child_process";

const PORTS = [3000, 4000];

function pidsOnPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
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

function main() {
  console.log("[reset] parando serviços locais…\n");
  for (const port of PORTS) killPort(port);

  console.log("\n[reset] pronto — ambiente zerado.\n");
  console.log("Próximos passos:");
  console.log("  1. Reative o Supabase no dashboard (se estiver pausado)");
  console.log("  2. npm run dev");
  console.log("  3. WhatsApp Cloud: backend com WHATSAPP_CLOUD_ENABLED=true + tunnel HTTPS (ngrok)");
}

main();
