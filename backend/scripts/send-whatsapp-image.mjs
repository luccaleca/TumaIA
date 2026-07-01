import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wppconnectSendImageUrl } from "../src/services/wppconnectClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env") });

const imageUrl =
  process.argv[2] ||
  "https://replicate.delivery/xezq/f4aE1HqeYZl9wkU1qgB98cJeAEfLPnEwm5ZZ3cBM01QEX8BbB/tmp0r7qr_5z.png";
const recipient = process.argv[3] || "169801683091677@lid";
const caption = process.argv[4] || "Arte gerada (recuperada do Replicate).";

const out = await wppconnectSendImageUrl(recipient, imageUrl, caption);
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
