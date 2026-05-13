import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { env } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../ia/usage");
const DATA_FILE = path.join(DATA_DIR, "replicate-image-usage.json");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function readUsage() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

async function writeUsage(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

/** Timestamps (ms) de POST /flux-schnell — janela móvel de 1 minuto. */
const postBurstTimestamps = [];
/** Timestamps de GET /replicate/ping */
const pingBurstTimestamps = [];

function pruneWindow(timestamps, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  while (timestamps.length && timestamps[0] < cutoff) {
    timestamps.shift();
  }
}

/**
 * @param {"post" | "ping"} kind
 * @param {number} maxPerMinute 0 = desliga o limite
 */
/**
 * Fail-closed: sem isto em `true`, rotas que debitam na Replicate retornam 503
 * mesmo com token válido.
 */
export function assertReplicateBillingAllowed() {
  if (!env.REPLICATE_ALLOW_BILLING) {
    return {
      ok: false,
      status: 503,
      error:
        "Geração de imagens (Replicate) desligada. Defina REPLICATE_ALLOW_BILLING=true no backend apenas quando quiser permitir débito de créditos. Ajuste REPLICATE_DAILY_SUCCESS_CAP conforme o orçamento (0 = ilimitado).",
    };
  }
  return { ok: true };
}

export function assertReplicateBurst(kind, maxPerMinute) {
  if (!maxPerMinute || maxPerMinute <= 0) {
    return { ok: true };
  }
  const arr = kind === "ping" ? pingBurstTimestamps : postBurstTimestamps;
  const windowMs = 60_000;
  pruneWindow(arr, windowMs);
  if (arr.length >= maxPerMinute) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((arr[0] + windowMs - Date.now()) / 1000),
    };
  }
  arr.push(Date.now());
  return { ok: true };
}

/**
 * @param {number} dailySuccessCap 0 = sem teto
 */
export async function assertReplicateDailySuccessCap(dailySuccessCap) {
  if (!dailySuccessCap || dailySuccessCap <= 0) {
    return { ok: true };
  }
  const usage = await readUsage();
  const key = todayKey();
  const day = usage[key] || {
    successes: 0,
    failures: 0,
    updated_at: null,
  };
  const successes = Number(day.successes) || 0;
  if (successes >= dailySuccessCap) {
    return {
      ok: false,
      successes,
      cap: dailySuccessCap,
    };
  }
  return { ok: true, successes, cap: dailySuccessCap };
}

/**
 * @param {{ ok: boolean, status?: number, model?: string, prediction_id?: string | null }} row
 */
export async function recordReplicateImageOutcome(row) {
  const usage = await readUsage();
  const key = todayKey();
  const day = usage[key] || {
    successes: 0,
    failures: 0,
    by_status: {},
    updated_at: null,
  };
  day.by_status = day.by_status && typeof day.by_status === "object" ? day.by_status : {};
  day.successes = Number.isFinite(day.successes) ? day.successes : 0;
  day.failures = Number.isFinite(day.failures) ? day.failures : 0;

  if (row.ok) {
    day.successes += 1;
  } else {
    day.failures += 1;
  }
  const statusKey = String(row.status ?? "unknown");
  day.by_status[statusKey] = (day.by_status[statusKey] || 0) + 1;
  day.updated_at = new Date().toISOString();
  if (row.prediction_id) {
    day.last_prediction_id = String(row.prediction_id);
  }
  if (row.model) {
    day.last_model = String(row.model);
  }

  usage[key] = day;
  await writeUsage(usage);

  if (row.ok) {
    const cap = env.REPLICATE_DAILY_SUCCESS_CAP;
    const extra =
      cap > 0
        ? ` successes_today=${day.successes} daily_cap=${cap} remaining=${Math.max(0, cap - day.successes)}`
        : " successes_today=" + day.successes + " (sem teto diário: REPLICATE_DAILY_SUCCESS_CAP=0)";
    console.warn(`[replicate][billing] generation ok model=${row.model ?? ""} prediction_id=${row.prediction_id ?? ""}${extra}`);
  }

  return day;
}

export async function getReplicateImageUsage() {
  const usage = await readUsage();
  const key = todayKey();
  const today =
    usage[key] || {
      successes: 0,
      failures: 0,
      by_status: {},
      updated_at: null,
    };
  return {
    date: key,
    today,
    history: usage,
  };
}
