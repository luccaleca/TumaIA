import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      const key = l.slice(0, i);
      let val = l.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [key, val];
    }),
);

const token = env.REPLICATE_API_TOKEN;
if (!token) {
  console.error("REPLICATE_API_TOKEN ausente no .env");
  process.exit(1);
}

const res = await fetch("https://api.replicate.com/v1/predictions", {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
if (!res.ok) {
  console.error(data);
  process.exit(1);
}

for (const p of (data.results || []).slice(0, 10)) {
  const out = Array.isArray(p.output) ? p.output[0] : p.output;
  console.log(
    JSON.stringify({
      id: p.id,
      status: p.status,
      created_at: p.created_at,
      model: p.model,
      url: typeof out === "string" ? out : null,
    }),
  );
}
