import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { whatsappCloudSendImageUrl } from "../src/services/whatsappCloudClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env") });

const imageUrl =
  process.argv[2] ||
  "https://replicate.delivery/xezq/f4aE1HqeYZl9wkU1qgB98cJeAEfLPnEwm5ZZ3cBM01QEX8BbB/tmp0r7qr_5z.png";
const recipient = process.argv[3] || process.env.WHATSAPP_CLOUD_TEST_TO || "";
const caption = process.argv[4] || "Arte gerada.";

if (!recipient) {
  console.error("Uso: node send-whatsapp-image.mjs <imageUrl> <telefoneE164> [caption]");
  process.exit(1);
}

const out = await whatsappCloudSendImageUrl(recipient, imageUrl, caption);
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
