import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { Router } from "express";
import { z } from "zod";
import { requireUserJwt } from "../middleware/requireUserJwt.js";
import { requireUsuario } from "../middleware/requireUsuario.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const r = Router();

const bodySchema = z.object({
  question: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(6000),
      })
    )
    .max(24)
    .optional(),
  /** Reservado p/ multi-tenant (Python pode ignorar até termos RAG por empresa). */
  id_empresa: z.string().uuid().optional(),
});

function runPythonChat(payload) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, "../../ia/python/run_chat.py");
    const pythonBin = process.env.PYTHON_BIN || "python";
    const proc = spawn(pythonBin, ["-X", "utf8", scriptPath], {
      cwd: path.resolve(__dirname, "../../ia/python"),
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Tempo esgotado ao consultar IA."));
    }, 90000);

    proc.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Falha ao executar IA (exit=${code})`));
        return;
      }
      try {
        resolve(JSON.parse(stdout || "{}"));
      } catch {
        reject(new Error("IA retornou JSON inválido."));
      }
    });

    proc.stdin.write(JSON.stringify({ question: payload.question, history: payload.history ?? [] }));
    proc.stdin.end();
  });
}

r.post("/chat", requireUserJwt, requireUsuario, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const result = await runPythonChat(parsed.data);
    if (!result?.ok) {
      res.status(502).json({ error: result?.error || "Falha na IA" });
      return;
    }
    res.json({
      answer: String(result.result || ""),
      source_documents: Array.isArray(result.source_documents) ? result.source_documents : [],
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao consultar IA",
    });
  }
});

export default r;
