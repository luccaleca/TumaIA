/**
 * Confere se REPLICATE_API_TOKEN está certo sem rodar modelo (GET /v1/account).
 * Uso (na pasta backend): npm run check:replicate
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const token = (process.env.REPLICATE_API_TOKEN || "").trim();
if (!token) {
  console.error("Defina REPLICATE_API_TOKEN em backend/.env (token da Replicate).");
  process.exit(1);
}

const res = await fetch("https://api.replicate.com/v1/account", {
  headers: { Authorization: `Bearer ${token}` },
});

const text = await res.text();
if (!res.ok) {
  console.error(`Falhou (${res.status}): ${text}`);
  process.exit(1);
}

try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
console.error("\nOK — token válido. Próximo: escolher um modelo no site e testar POST /predictions ou integrar no Node.");
