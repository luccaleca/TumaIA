import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { env } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WORKER_SCRIPT = path.resolve(__dirname, "../../ia/python/chat_worker.py");
const WORKER_CWD = path.resolve(__dirname, "../../ia/python");

let child = null;
let stdoutBuf = "";
let booted = false;
/** @type {{ resolve: () => void; reject: (e: Error) => void } | null} */
let bootWait = null;
/** @type {{ resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout } | null} */
let pending = null;
/** @type {Promise<void> | null} */
let bootPromise = null;

/** Fila simples: uma requisição por vez no stdin do worker. */
let chain = Promise.resolve();

const CHAT_WORKER_BOOT_TIMEOUT_MS = Number(env.CHAT_WORKER_BOOT_TIMEOUT_MS) || 480_000;
const CHAT_WORKER_REQUEST_TIMEOUT_MS = Number(env.CHAT_WORKER_REQUEST_TIMEOUT_MS) || 360_000;

function logStderr(chunk) {
  const t = String(chunk).trimEnd();
  if (t) console.error("[chat-worker]", t);
}

/**
 * @param {{ force?: boolean }} [opts] — `force`: encerramento do servidor (mata subprocesso mais agressivo no Windows).
 */
function killChild(opts = {}) {
  const force = opts.force === true;
  if (!child) {
    stdoutBuf = "";
    return;
  }
  try {
    if (force && process.platform === "win32") {
      child.kill("SIGKILL");
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    /* ignore */
  }
  child = null;
  booted = false;
  stdoutBuf = "";
  bootPromise = null;
  chain = Promise.resolve();
  if (bootWait) {
    bootWait.reject(new Error("Worker do chat encerrado."));
    bootWait = null;
  }
  if (pending) {
    clearTimeout(pending.timer);
    pending.reject(new Error("Worker do chat encerrado."));
    pending = null;
  }
}

/** Chama no SIGINT/SIGTERM para liberar porta e processo Python. */
export function shutdownChatWorker() {
  killChild({ force: true });
}

function handleStdoutLine(line) {
  if (!booted) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      bootWait?.reject(new Error("Worker retornou JSON inválido no boot."));
      bootWait = null;
      killChild();
      return;
    }
    if (msg?.ok === false) {
      const errText = typeof msg.error === "string" ? msg.error : "Falha ao iniciar worker do chat";
      bootWait?.reject(new Error(errText));
      bootWait = null;
      killChild();
      return;
    }
    booted = true;
    bootWait?.resolve();
    bootWait = null;
    return;
  }

  if (!pending) return;
  clearTimeout(pending.timer);
  const { resolve, reject } = pending;
  pending = null;
  try {
    resolve(JSON.parse(line));
  } catch {
    reject(new Error("IA retornou JSON inválido."));
  }
}

function attachStdout() {
  if (!child?.stdout) return;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuf += chunk;
    for (;;) {
      const nl = stdoutBuf.indexOf("\n");
      if (nl === -1) break;
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      handleStdoutLine(line);
    }
  });
}

/**
 * Garante processo Python vivo e com índice carregado (primeira chamada é lenta).
 */
export function ensureChatWorkerReady() {
  if (child && booted) return Promise.resolve();
  if (bootPromise) return bootPromise;

  bootPromise = new Promise((resolve, reject) => {
    bootWait = {
      resolve: () => resolve(),
      reject: (e) => reject(e),
    };

    const pythonBin = process.env.PYTHON_BIN || "python";
    const proc = spawn(pythonBin, ["-X", "utf8", WORKER_SCRIPT], {
      cwd: WORKER_CWD,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    child = proc;
    stdoutBuf = "";
    booted = false;

    proc.stderr?.on("data", logStderr);

    proc.on("error", (err) => {
      bootWait?.reject(err);
      bootWait = null;
      killChild();
    });

    proc.on("close", (code) => {
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(
          new Error(
            code === 0 ? "Worker do chat encerrado." : `Worker do chat saiu com código ${code}.`,
          ),
        );
        pending = null;
      }
      if (!booted) {
        bootWait?.reject(new Error(`Worker do chat não inicializou (exit=${code}).`));
        bootWait = null;
      }
      child = null;
      booted = false;
      bootPromise = null;
    });

    attachStdout();

    setTimeout(() => {
      if (!booted && bootWait) {
        bootWait.reject(new Error("Tempo esgotado ao iniciar o worker do chat (índice / Python)."));
        bootWait = null;
        killChild();
        bootPromise = null;
      }
    }, CHAT_WORKER_BOOT_TIMEOUT_MS).unref();
  });

  return bootPromise;
}

export function getChatWorkerTimeoutMs() {
  return {
    bootMs: CHAT_WORKER_BOOT_TIMEOUT_MS,
    requestMs: CHAT_WORKER_REQUEST_TIMEOUT_MS,
  };
}

/**
 * @param {{ question: string, history?: Array<{ role: string, content: string }>, id_empresa?: string }} payload
 * @param {{ timeoutMs?: number }} [opts]
 */
export function runChatPythonWorker(payload, opts = {}) {
  const timeoutMs =
    typeof opts.timeoutMs === "number" ? opts.timeoutMs : CHAT_WORKER_REQUEST_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    if (!child?.stdin || !booted) {
      reject(new Error("Worker do chat não está pronto."));
      return;
    }
    if (pending) {
      reject(new Error("Worker do chat ocupado."));
      return;
    }

    const timer = setTimeout(() => {
      pending = null;
      killChild();
      reject(new Error("Tempo esgotado ao consultar IA."));
    }, timeoutMs);

    pending = { resolve, reject, timer };

    const line = `${JSON.stringify({
      question: payload.question,
      history: payload.history ?? [],
      ...(payload.id_empresa ? { id_empresa: payload.id_empresa } : {}),
      ...(payload.acervo_context ? { acervo_context: payload.acervo_context } : {}),
      ...(payload.chat_mode ? { chat_mode: payload.chat_mode } : {}),
    })}\n`;
    const ok = child.stdin.write(line, "utf8", (err) => {
      if (err) {
        clearTimeout(timer);
        pending = null;
        reject(err);
      }
    });
    if (!ok) {
      child.stdin.once("drain", () => {});
    }
  });
}

/**
 * Serializa chamadas ao worker (stdin é um único fluxo).
 * @param {{ question: string, history?: Array<{ role: string, content: string }>, id_empresa?: string }} payload
 */
export async function runChatSerialized(payload, opts = {}) {
  await ensureChatWorkerReady();
  const run = chain.then(() =>
    runChatPythonWorker(payload, {
      timeoutMs:
        typeof opts.timeoutMs === "number" ? opts.timeoutMs : CHAT_WORKER_REQUEST_TIMEOUT_MS,
    }),
  );
  chain = run.catch(() => {});
  return run;
}
