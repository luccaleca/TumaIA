import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../ia/usage");
const DATA_FILE = path.join(DATA_DIR, "gemini-text-usage.json");

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

export async function recordGeminiTextCall({
  ok,
  status,
  inputTokens = 0,
  outputTokens = 0,
  totalTokens = 0,
  model = "",
}) {
  const usage = await readUsage();
  const key = todayKey();
  const day = usage[key] || {
    total_calls: 0,
    ok_calls: 0,
    error_calls: 0,
    by_status: {},
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    calls_with_token_metadata: 0,
    by_model: {},
    updated_at: null,
  };
  day.by_status = day.by_status && typeof day.by_status === "object" ? day.by_status : {};
  day.by_model = day.by_model && typeof day.by_model === "object" ? day.by_model : {};
  day.input_tokens = Number.isFinite(day.input_tokens) ? day.input_tokens : 0;
  day.output_tokens = Number.isFinite(day.output_tokens) ? day.output_tokens : 0;
  day.total_tokens = Number.isFinite(day.total_tokens) ? day.total_tokens : 0;
  day.calls_with_token_metadata = Number.isFinite(day.calls_with_token_metadata)
    ? day.calls_with_token_metadata
    : 0;

  day.total_calls += 1;
  if (ok) day.ok_calls += 1;
  else day.error_calls += 1;

  const statusKey = String(status || "unknown");
  day.by_status[statusKey] = (day.by_status[statusKey] || 0) + 1;

  const safeInputTokens = Number.isFinite(inputTokens) ? inputTokens : 0;
  const safeOutputTokens = Number.isFinite(outputTokens) ? outputTokens : 0;
  const safeTotalTokens = Number.isFinite(totalTokens) ? totalTokens : 0;
  const safeModel = typeof model === "string" ? model.trim() : "";
  const hasTokenMetadata = safeInputTokens > 0 || safeOutputTokens > 0 || safeTotalTokens > 0;
  if (hasTokenMetadata) {
    day.input_tokens += safeInputTokens;
    day.output_tokens += safeOutputTokens;
    day.total_tokens += safeTotalTokens;
    day.calls_with_token_metadata += 1;
  }
  if (safeModel) {
    day.by_model[safeModel] = (day.by_model[safeModel] || 0) + 1;
  }
  day.updated_at = new Date().toISOString();

  usage[key] = day;
  await writeUsage(usage);
  return day;
}

export async function getGeminiTextUsage() {
  const usage = await readUsage();
  const key = todayKey();
  const today = usage[key] || {
    total_calls: 0,
    ok_calls: 0,
    error_calls: 0,
    by_status: {},
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    calls_with_token_metadata: 0,
    by_model: {},
    updated_at: null,
  };

  return {
    date: key,
    today,
    history: usage,
  };
}

