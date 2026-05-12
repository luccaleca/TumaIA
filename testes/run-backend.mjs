import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testesDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(testesDir, "..");
const backendTestsDir = path.join(testesDir, "backend");

const files = readdirSync(backendTestsDir)
  .filter((f) => f.endsWith(".test.js"))
  .map((f) => path.join(backendTestsDir, f))
  .sort();

if (!files.length) {
  console.error("Nenhum arquivo *.test.js em testes/backend/");
  process.exit(1);
}

const r = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  cwd: repoRoot,
});

process.exit(r.status === null ? 1 : r.status);
