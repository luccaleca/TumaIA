import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Pasta do app Next (`frontend/`) */
const appRoot = path.resolve(__dirname);
/** Raiz do monorepo (`package-lock.json` + `node_modules` hoistado pelo npm workspaces) */
const repoRoot = path.resolve(__dirname, "..");
const requireFromApp = createRequire(path.join(appRoot, "package.json"));

function pkgRoot(name) {
  try {
    return path.dirname(requireFromApp.resolve(`${name}/package.json`));
  } catch {
    return null;
  }
}

const tailwindRoot = pkgRoot("tailwindcss");
const tailwindPostcssRoot = pkgRoot("@tailwindcss/postcss");
const turbopackResolveAlias = {};
if (tailwindRoot) turbopackResolveAlias.tailwindcss = tailwindRoot;
if (tailwindPostcssRoot) turbopackResolveAlias["@tailwindcss/postcss"] = tailwindPostcssRoot;

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
 * LAN / Tailscale / etc.: origens extras permitidas para o dev server (inclui WebSocket do HMR).
 * Descobre IPv4 privados/CGNAT desta máquina (ex. 100.x Tailscale) e une com TUMAIA_ALLOWED_DEV_ORIGINS.
 */
function discoverDevHostIps() {
  const hosts = new Set();
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (!a || a.family !== "IPv4" || a.internal) continue;
      const ip = a.address;
      if (
        /^100\./.test(ip) ||
        /^192\.168\./.test(ip) ||
        /^10\./.test(ip) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
      ) {
        hosts.add(ip);
      }
    }
  }
  return [...hosts];
}

const fromEnv = (process.env.TUMAIA_ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedDevOrigins = [
  ...new Set(["127.0.0.1", "localhost", "192.168.0.70", ...discoverDevHostIps(), ...fromEnv]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Requisições longas via rewrite (`/tumaia-backend/*`) — ex. POST /ia/chat, /ia/image-preview —
   * excedem o timeout padrão do proxy do Next (~30s) e o dev server registra ECONNRESET / socket hang up.
   * Alinhar com `timeoutMs` em `frontend/lib/auth.js` e nas chamadas do painel de chat.
   */
  experimental: {
    proxyTimeout: 180_000,
  },

  /**
   * Monorepo (npm workspaces): o lockfile fica na raiz do repo; o Next e o Tailwind ficam em
   * `../node_modules`. O Turbopack precisa usar essa raiz para resolver pacotes; senão infere
   * diretório errado (ex.: `frontend/app`) e falha ao achar `next` ou `tailwindcss`.
   */
  turbopack: {
    root: repoRoot,
    ...(Object.keys(turbopackResolveAlias).length > 0 && {
      resolveAlias: turbopackResolveAlias,
    }),
  },

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
