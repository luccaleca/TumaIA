/**
 * Smoke test: 1 imagem com black-forest-labs/flux-schnell (~custo bem baixo / imagem na Replicate).
 * Uso: npm run test:replicate:smoke  (da raiz) ou dentro de backend/.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const TOKEN = (process.env.REPLICATE_API_TOKEN || "").trim();
if (!TOKEN) {
  console.error("Defina REPLICATE_API_TOKEN em backend/.env");
  process.exit(1);
}

const BASE = "https://api.replicate.com/v1";
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const MODEL_OWNER = "black-forest-labs";
const MODEL_NAME = "flux-schnell";

async function getLatestVersionId() {
  const res = await fetch(`${BASE}/models/${MODEL_OWNER}/${MODEL_NAME}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`GET models: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const id = json?.latest_version?.id;
  if (!id) throw new Error("Resposta sem latest_version.id");
  return String(id);
}

async function pollPrediction(predictionUrl) {
  const maxWaitMs = 120_000;
  const stepMs = 1500;
  const t0 = Date.now();
  for (;;) {
    const res = await fetch(predictionUrl, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) throw new Error(`GET prediction: ${res.status} ${await res.text()}`);
    const p = await res.json();
    const st = String(p.status || "");
    if (st === "succeeded") return p;
    if (st === "failed" || st === "canceled") throw new Error(p.error ? JSON.stringify(p.error) : `status=${st}`);
    if (Date.now() - t0 > maxWaitMs) throw new Error("Timeout esperando prediction");
    process.stderr.write(`\rstatus: ${st} …`);
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

const versionId = await getLatestVersionId();
console.error(`Modelo ${MODEL_OWNER}/${MODEL_NAME}`);
console.error(`version: ${versionId.slice(0, 12)}…`);

const prompt =
  process.argv.slice(2).join(" ").trim() ||
  "Minimal flat illustration of a single hamburger, soft pastel palette, centered, simple shadows, square composition";

const createRes = await fetch(`${BASE}/predictions`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    version: versionId,
    input: {
      prompt,
      num_outputs: 1,
      aspect_ratio: "1:1",
      output_format: "png",
      output_quality: 80,
    },
  }),
});

if (!createRes.ok) {
  const raw = await createRes.text();
  console.error(raw);
  if (createRes.status === 402) {
    console.error(`
→ Créditos insuficientes. Adicione saldo em: https://replicate.com/account/billing`);
  }
  throw new Error(`POST predictions: ${createRes.status}`);
}

const created = await createRes.json();
const getUrl = created?.urls?.get;
if (!getUrl) throw new Error("Sem urls.get na resposta");

console.error("\nPrediction id:", created.id);
const final = await pollPrediction(getUrl);
console.error("\n");

const out = final.output;
if (Array.isArray(out)) {
  out.forEach((url, i) => console.log(String(url)));
} else if (typeof out === "string") {
  console.log(out);
} else {
  console.log(JSON.stringify(final, null, 2));
}

console.error("\nOK — pode abrir a URL acima no navegador. Isso debita uso na sua conta Replicate.");
