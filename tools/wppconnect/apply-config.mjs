/**
 * Aplica configuração TumaIA no wppconnect-server clonado em ./server
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "server", "src", "config.ts");

const TUMAIA = {
  secretKey: "tumaia-demo-secret",
  deviceName: "TumaIA",
  webhookUrl: "http://localhost:4000/wppconnect/webhook",
  session: "tumaia",
};

if (!fs.existsSync(configPath)) {
  console.error("Config não encontrado. Rode: npm run wppconnect:setup");
  process.exit(1);
}

let src = fs.readFileSync(configPath, "utf8");

src = src.replace(/secretKey:\s*'[^']*'/, `secretKey: '${TUMAIA.secretKey}'`);
src = src.replace(/deviceName:\s*'[^']*'/, `deviceName: '${TUMAIA.deviceName}'`);
src = src.replace(/url:\s*null/, `url: '${TUMAIA.webhookUrl}'`);

fs.writeFileSync(configPath, src, "utf8");

const metaPath = path.join(__dirname, "tumaia.meta.json");
fs.writeFileSync(
  metaPath,
  JSON.stringify(
    {
      ...TUMAIA,
      baseUrl: "http://127.0.0.1:21465",
      appliedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf8",
);

console.log("[wppconnect] config aplicada:");
console.log(`  secretKey: ${TUMAIA.secretKey}`);
console.log(`  webhook:   ${TUMAIA.webhookUrl}`);
console.log(`  sessão:    ${TUMAIA.session}`);
