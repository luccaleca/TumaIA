import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Integração local: porta do backend vem só de backend/.env (PORT).
 * O Next faz proxy de /tumaia-backend/* → Express; não precisa de .env no front.
 */
function getBackendOriginFromBackendEnvFile() {
  const envPath = path.join(__dirname, "..", "backend", ".env");
  try {
    const txt = fs.readFileSync(envPath, "utf8");
    const m = txt.match(/^\s*PORT\s*=\s*(\d+)\s*$/m);
    if (m) return `http://127.0.0.1:${m[1]}`;
  } catch {
    /* arquivo ausente ou ilegível */
  }
  return "http://127.0.0.1:4000";
}

const BACKEND_ORIGIN = getBackendOriginFromBackendEnvFile();

/**
 * LAN / outro hostname no dev: permite WebSocket do HMR (`/_next/webpack-hmr`).
 * Ajuste com TUMAIA_ALLOWED_DEV_ORIGINS=192.168.0.70,192.168.1.5 (lista separada por vírgula).
 */
const allowedDevOrigins = (process.env.TUMAIA_ALLOWED_DEV_ORIGINS || "192.168.0.70")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins,

  async rewrites() {
    return [
      {
        source: "/tumaia-backend/:path*",
        destination: `${BACKEND_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
