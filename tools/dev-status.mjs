/**
 * Mostra o que já está rodando nas portas do dev local + Supabase.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", "backend", ".env");

function readEnvKey(name) {
  try {
    const txt = fs.readFileSync(envPath, "utf8");
    const m = txt.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)\\s*$`, "m"));
    if (!m) return "";
    return m[1].replace(/^["']|["']$/g, "").trim();
  } catch {
    return "";
  }
}

async function probeSupabaseDirect() {
  const url = readEnvKey("SUPABASE_URL").replace(/\/$/, "");
  const key = readEnvKey("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { ok: false, hint: "SUPABASE não configurado no backend/.env" };
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 521) {
      return { ok: false, status: 521, hint: "Projeto Supabase pausado — reative no dashboard" };
    }
    return { ok: res.ok, status: res.status, hint: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const CHECKS = [
  { name: "frontend", port: 3000, url: "http://127.0.0.1:3000" },
  { name: "backend", port: 4000, url: "http://127.0.0.1:4000/health" },
  { name: "wppconnect", port: 21465, url: "http://127.0.0.1:21465/api-docs" },
];

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return { up: res.ok || res.status < 500, json: res.ok ? await res.json().catch(() => null) : null };
  } catch {
    return { up: false, json: null };
  }
}

async function main() {
  console.log("[dev] status do TumaIA local:\n");
  let anyUp = false;
  let health = null;

  for (const c of CHECKS) {
    const { up, json } = await probe(c.url);
    if (c.name === "backend") health = json;
    if (up) anyUp = true;
    console.log(`  ${up ? "✓" : "·"} :${c.port}  ${c.name}${up ? " (ativo)" : ""}`);
  }

  let dbOk = true;
  let dbHint = "";

  if (health?.supabase) {
    dbOk = health.supabase.ok;
    dbHint = health.supabase.hint || health.supabase.error || `HTTP ${health.supabase.status}`;
    if (!health.ready) {
      console.log("\n  ⚠ Backend no ar, mas banco indisponível — login/chat/WhatsApp IA não funcionam.");
    }
  } else {
    const s = await probeSupabaseDirect();
    dbOk = s.ok;
    dbHint = s.hint || s.error || `HTTP ${s.status}`;
    if (!s.ok) {
      console.log("\n  ⚠ Backend no ar, mas banco indisponível — login/chat/WhatsApp IA não funcionam.");
    }
  }

  console.log(`  ${dbOk ? "✓" : "✗"} supabase  ${dbOk ? "conectado" : dbHint}`);

  console.log("");
  if (!anyUp) {
    console.log("Nada ativo. Rode: npm run dev:mono  (site + backend + WhatsApp)");
    return;
  }

  console.log("Site: http://localhost:3000");
  console.log("Detalhes: http://127.0.0.1:4000/health");

  if (!dbOk) {
    console.log("\nReative o projeto no Supabase Dashboard e recarregue o site.");
  } else {    console.log("\nSe deu EADDRINUSE ao subir de novo, os processos acima já estão rodando.");
    console.log("Subir tudo: npm run dev:mono");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
