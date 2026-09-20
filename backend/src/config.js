import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const empty = (v) => (v === "" || v === undefined ? undefined : v);

/** `true` só com valores explícitos; vazio / inválido = `defaultVal` (fail-closed). */
function parseEnvBool(v, defaultVal = false) {
  if (v === "" || v === undefined) return defaultVal;
  const s = String(v).trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(s)) return false;
  if (["1", "true", "yes", "on"].includes(s)) return true;
  return defaultVal;
}

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  INTERNAL_WEBHOOK_SECRET: z.preprocess(empty, z.string().min(1).optional()),
  SUPABASE_URL: z.preprocess(empty, z.string().url().optional()),
  SUPABASE_ANON_KEY: z.preprocess(empty, z.string().optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(empty, z.string().optional()),
  DATABASE_URL: z.preprocess(empty, z.string().optional()),
  /** API OpenAI-compatível (ex.: Ollama `http://127.0.0.1:11434/v1`). */
  LLAMA_BASE_URL: z.preprocess(empty, z.string().url().optional()),
  LLAMA_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  /** Modelo só para `post-context-proposal` (padrão: mesmo que LLAMA_MODEL / qwen2.5:3b). */
  LLAMA_PROPOSAL_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  /**
   * `false` (padrão): resumo de confirmação montado só com dados do painel (rápido, ~1–3s).
   * `true`: tenta Llama antes; se demorar, cai no painel.
   */
  POST_CONTEXT_USE_LLAMA: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  /** Timeout de uma chamada Llama na proposta de contexto (ms). Padrão 32s. */
  LLAMA_PROPOSAL_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? 32_000 : Number(v)),
    z.number().int().min(8_000).max(600_000),
  ),
  /**
   * Boot do worker Python (Chroma + embeddings). Primeira subida pode levar vários minutos.
   * Padrão 8 min.
   */
  CHAT_WORKER_BOOT_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? 480_000 : Number(v)),
    z.number().int().min(60_000).max(900_000),
  ),
  /**
   * Uma pergunta no worker após o boot (RAG + LLM). Padrão 6 min.
   */
  CHAT_WORKER_REQUEST_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? 360_000 : Number(v)),
    z.number().int().min(30_000).max(900_000),
  ),
  /** Perguntas fora do escopo (conversa_aberta) — prompt curto; padrão 90s. */
  CHAT_NATURAL_REQUEST_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? 90_000 : Number(v)),
    z.number().int().min(15_000).max(300_000),
  ),
  /**
   * Chat no Node (regras + estados + LLM). Padrão ligado.
   * Defina `false` só para depurar o legado `backend/ia/python/`.
   */
  TUMAIA_NODE_CHAT: z.preprocess((v) => parseEnvBool(v, true), z.boolean()),
  /**
   * Alias: força Node no WhatsApp. Com `TUMAIA_NODE_CHAT=true` (padrão) já cobre painel e WhatsApp.
   */
  TUMAIA_WHATSAPP_FAST_PATH: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  /** Modelo Ollama para conversa no Node (ex.: llama3.2:1b). Padrão: LLAMA_MODEL. */
  OLLAMA_FAST_CHAT_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  /**
   * Motor conversacional: `cloud` (padrão) ou `ollama` (local).
   * Com `cloud`, use CHAT_CLOUD_API_KEY.
   */
  CHAT_LLM_PROVIDER: z.preprocess((v) => {
    const s = String(v ?? "cloud").trim().toLowerCase();
    if (s === "ollama") return "ollama";
    return "cloud";
  }, z.enum(["ollama", "cloud"])),
  CHAT_CLOUD_API_KEY: z.preprocess(empty, z.string().min(1).optional()),
  CHAT_CLOUD_MODEL: z.preprocess(
    (v) => (v === "" || v === undefined ? "grok-4.6" : String(v).trim()),
    z.string().min(1),
  ),
  /**
   * Runtime do SDK do chat: `local` (padrão, sem VM) ou `cloud` (VM hospedada; rate limit).
   */
  CHAT_CLOUD_RUNTIME: z.preprocess((v) => {
    const s = String(v ?? "local").trim().toLowerCase();
    if (s === "cloud") return "cloud";
    return "local";
  }, z.enum(["local", "cloud"])),
  /** CWD isolado do agente local (padrão: tmp/tumaia-chat-agent). */
  CHAT_CLOUD_LOCAL_CWD: z.preprocess(empty, z.string().min(1).optional()),
  CHAT_CLOUD_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? 300_000 : Number(v)),
    z.number().int().min(30_000).max(900_000),
  ),
  /** Reutiliza sessão cloud na mesma conversa (menos cold start). Padrão 25 min. */
  CHAT_CLOUD_SESSION_TTL_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? 1_500_000 : Number(v)),
    z.number().int().min(60_000).max(3_600_000),
  ),
  /**
   * Demo: LLM interpreta linguagem humana com `.md` em `backend/ia/agente/`.
   * Código determinístico fica em ferramentas/guardrails (acervo, formato UI, imagem real).
   */
  CHAT_DEMO_AGENT: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  /**
   * Interpretação semântica de criação via LLM (JSON estruturado).
   * Desligado por padrão: fallback determinístico sempre disponível.
   */
  CHAT_CREATION_LLM_INTERPRET: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  /**
   * Provider só da interpretação de criação: `ollama` (padrão) ou `cloud`.
   * Independente de CHAT_LLM_PROVIDER do chat conversacional.
   */
  CHAT_CREATION_LLM_PROVIDER: z.preprocess((v) => {
    const s = String(v ?? "ollama").trim().toLowerCase();
    if (s === "cloud") return "cloud";
    return "ollama";
  }, z.enum(["ollama", "cloud"])),
  /** Timeout da interpretação estruturada de criação (ms). Padrão 90s (Ollama local). */
  CHAT_CREATION_LLM_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? 90_000 : Number(v)),
    z.number().int().min(5_000).max(180_000),
  ),
  /** Modelo multimodal para análise de imagem (ex. `llava:7b` no Ollama). */
  LLAMA_VISION_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  /** Vision só para identidade da marca (ex. `llava:13b` ou `llama3.2-vision:11b`). */
  IDENTIDADE_VISION_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  /** Texto só para identidade (site/legenda sem imagem). */
  IDENTIDADE_ANALISE_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  LLAMA_API_KEY: z.preprocess(empty, z.string().optional()),
  LLAMA_DAILY_TOKEN_BUDGET: z.preprocess(empty, z.coerce.number().int().positive().optional()),
  MEDIA_BUCKET: z.preprocess(empty, z.string().optional()),
  /** Loga o prompt completo de `/ia/image-preview` no stderr (só para depuração local). */
  IMAGE_PREVIEW_LOG_PROMPT: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  /**
   * `compact` (padrão): prompt curto só com visual + cores + frase — melhor para modelos de imagem.
   * `full`: blocos Client request + Brand identity (texto longo).
   */
  IMAGE_PROMPT_STYLE: z.preprocess(
    (v) => {
      const s = String(v ?? "compact")
        .trim()
        .toLowerCase();
      return s === "full" ? "full" : "compact";
    },
    z.enum(["compact", "full"]),
  ),
  /**
   * `grok` (padrão) = Grok Imagine na xAI (CHAT_CLOUD_API_KEY / XAI_API_KEY).
   * `replicate` = secundário — openai/gpt-image-2 na Replicate.
   * `openai` = API direta OpenAI (OPENAI_API_KEY).
   */
  IMAGE_PROVIDER: z.preprocess((v) => {
    const s = String(v ?? "grok")
      .trim()
      .toLowerCase();
    if (s === "replicate" || s === "openai") return s;
    if (s === "flux") return "replicate";
    return "grok";
  }, z.enum(["grok", "replicate", "openai"])),
  /** Alias opcional da chave xAI; se vazio, usa CHAT_CLOUD_API_KEY. */
  XAI_API_KEY: z.preprocess(empty, z.string().min(1).optional()),
  GROK_ALLOW_BILLING: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  GROK_IMAGE_MODEL: z.preprocess(
    (v) => (v === "" || v === undefined ? "grok-imagine-image-2.0" : String(v).trim()),
    z.string().min(1),
  ),
  GROK_IMAGE_QUALITY: z.preprocess((v) => {
    const s = String(v ?? "auto").trim().toLowerCase();
    if (s === "low" || s === "medium" || s === "auto") return s;
    return "auto";
  }, z.enum(["low", "medium", "auto"])),
  GROK_IMAGE_RESOLUTION: z.preprocess((v) => {
    const s = String(v ?? "1k").trim().toLowerCase();
    return s === "2k" ? "2k" : "1k";
  }, z.enum(["1k", "2k"])),
  GROK_IMAGE_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? 180_000 : Number(v)),
    z.number().int().min(30_000).max(600_000),
  ),
  REPLICATE_GPT_IMAGE_QUALITY: z.preprocess(
    (v) => {
      const s = String(v ?? "high").trim().toLowerCase();
      if (["low", "medium", "high", "auto"].includes(s)) return s;
      return "high";
    },
    z.enum(["low", "medium", "high", "auto"]),
  ),
  /** IA de texto: `replicate` (padrão se billing ativo), `ollama` ou `openai`. */
  TEXT_PROVIDER: z.preprocess((v) => {
    const s = String(v ?? "").trim().toLowerCase();
    if (s === "replicate" || s === "ollama" || s === "openai") return s;
    return undefined;
  }, z.enum(["replicate", "ollama", "openai"]).optional()),
  /** Modelo Replicate para legenda/copy (`owner/name`). */
  REPLICATE_TEXT_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  /** Modelo OpenAI para texto (legenda, etc.). */
  OPENAI_CHAT_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  REPLICATE_GPT_IMAGE_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? 300_000 : Number(v)),
    z.number().int().min(60_000).max(600_000),
  ),
  /**
   * `raw` (padrão): pedido + identidade da marca (+ refs em edits).
   * `standard`: legado de montagem antiga — preferir `raw`.
   */
  IMAGE_PIPELINE: z.preprocess(
    (v) => (String(v ?? "raw").trim().toLowerCase() === "standard" ? "standard" : "raw"),
    z.enum(["raw", "standard"]),
  ),
  /**
   * `gpt_integrated` (padrão): PNGs do acervo em `input_images` / `images.edit`.
   * `collage` / `collage_refine`: legado Sharp — só debug local; não usar em produção.
   */
  IMAGE_PRODUCT_MODE: z.preprocess((v) => {
    const s = String(v ?? "gpt_integrated").trim().toLowerCase();
    if (s === "collage" || s === "collage_refine") return s;
    return "gpt_integrated";
  }, z.enum(["gpt_integrated", "collage", "collage_refine"])),
  /** Revisão visual (Ollama/Llava) antes de entregar prévia — padrão desligado; `true` liga. */
  IMAGE_PREVIEW_QUALITY_REVIEW: z.preprocess(
    (v) => parseEnvBool(v, false),
    z.boolean(),
  ),
  /** Nota mínima (0–100) para aprovar na revisão. Padrão 68. */
  IMAGE_PREVIEW_QUALITY_MIN_SCORE: z.preprocess(
    (v) => (v === "" || v === undefined ? 68 : Number(v)),
    z.number().int().min(0).max(100),
  ),
  OPENAI_API_KEY: z.preprocess(empty, z.string().min(1).optional()),
  OPENAI_ALLOW_BILLING: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  OPENAI_IMAGE_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  OPENAI_IMAGE_QUALITY: z.preprocess(
    (v) => {
      const s = String(v ?? "high").trim().toLowerCase();
      if (["low", "medium", "standard"].includes(s)) return s;
      return "high";
    },
    z.enum(["low", "medium", "high", "standard"]),
  ),
  OPENAI_IMAGE_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? 180_000 : Number(v)),
    z.number().int().min(30_000).max(600_000),
  ),
  IMAGE_DAILY_SUCCESS_CAP: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).max(100_000).optional(),
  ),
  IMAGE_BURST_PER_MINUTE: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).max(300).optional(),
  ),
  REPLICATE_API_TOKEN: z.preprocess(empty, z.string().min(1).optional()),
  /**
   * Só com `true`/`1`/`yes`/`on` gera imagem (rotas que debitam na Replicate).
   * Token sozinho não gasta; evita deploy com chave e esquecimento.
   */
  REPLICATE_ALLOW_BILLING: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  /** Máx. POST que debitam Replicate por minuto (0 = sem limite). Padrão 6. */
  REPLICATE_BURST_PER_MINUTE: z.preprocess(
    (v) => (v === "" || v === undefined ? 6 : Number(v)),
    z.number().int().min(0).max(300),
  ),
  /** Máx. GET /internal/replicate/ping por minuto (0 = sem limite). Padrão 10. */
  REPLICATE_PING_PER_MINUTE: z.preprocess(
    (v) => (v === "" || v === undefined ? 10 : Number(v)),
    z.number().int().min(0).max(300),
  ),
  /** Máx. gerações com sucesso por dia (0 = ilimitado). Padrão 50. */
  REPLICATE_DAILY_SUCCESS_CAP: z.preprocess(
    (v) => (v === "" || v === undefined ? 50 : Number(v)),
    z.number().int().min(0).max(100_000),
  ),
  /** Integração direta WPPConnect → IA no WhatsApp (sem n8n). */
  WPPCONNECT_ENABLED: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  WPPCONNECT_BASE_URL: z.preprocess(
    (v) => (v === "" || v === undefined ? "http://127.0.0.1:21465" : String(v).trim()),
    z.string().url(),
  ),
  WPPCONNECT_SESSION: z.preprocess(
    (v) => (v === "" || v === undefined ? "tumaia" : String(v).trim()),
    z.string().min(1).max(64),
  ),
  WPPCONNECT_SECRET_KEY: z.preprocess(empty, z.string().min(1).optional()),
  /** Token Bearer fixo (opcional; senão gera via SECRET_KEY). */
  WPPCONNECT_TOKEN: z.preprocess(empty, z.string().min(1).optional()),
  /** Segredo opcional no webhook (?secret= ou header x-wppconnect-secret). */
  WPPCONNECT_WEBHOOK_SECRET: z.preprocess(empty, z.string().min(1).optional()),
  WPPCONNECT_PROCESS_GROUPS: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  /**
   * WhatsApp Cloud API (Meta Graph) — canal oficial.
   * Phone number ID ≠ número E.164; vem em WhatsApp → API Setup.
   */
  WHATSAPP_CLOUD_ENABLED: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  WHATSAPP_CLOUD_ACCESS_TOKEN: z.preprocess(empty, z.string().min(1).optional()),
  WHATSAPP_CLOUD_PHONE_NUMBER_ID: z.preprocess(empty, z.string().min(1).optional()),
  WHATSAPP_CLOUD_WABA_ID: z.preprocess(empty, z.string().min(1).optional()),
  WHATSAPP_CLOUD_VERIFY_TOKEN: z.preprocess(empty, z.string().min(1).optional()),
  /** App Secret do app Meta — valida X-Hub-Signature-256 no POST do webhook (opcional em lab). */
  WHATSAPP_CLOUD_APP_SECRET: z.preprocess(empty, z.string().min(1).optional()),
  WHATSAPP_CLOUD_API_VERSION: z.preprocess(
    (v) => (v === "" || v === undefined ? "v21.0" : String(v).trim()),
    z.string().min(2).max(16),
  ),
  /**
   * Publicação Instagram direta (Meta Graph API Content Publishing).
   * Conta Professional/Business vinculada a Página do Facebook.
   */
  INSTAGRAM_GRAPH_ACCESS_TOKEN: z.preprocess(empty, z.string().min(1).optional()),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.preprocess(empty, z.string().min(1).optional()),
  INSTAGRAM_GRAPH_API_VERSION: z.preprocess(
    (v) => (v === "" || v === undefined ? "v21.0" : String(v).trim()),
    z.string().min(2).max(16),
  ),
  INSTAGRAM_PUBLISH_TIMEOUT_MS: z.preprocess(
    (v) => (v === "" || v === undefined ? 120_000 : Number(v)),
    z.number().int().min(15_000).max(300_000),
  ),
  /**
   * Allowlist de e-mails com acesso ao TumaCore Plataforma (`/plataforma/*`).
   * Separados por vírgula. Não usar domínio genérico. Independente do cargo
   * administrador da empresa (TumaCore Empresa / workspace do cliente).
   */
  TUMAIA_PLATAFORMA_ADMIN_EMAILS: z.preprocess(
    (v) => (v === "" || v === undefined ? "" : String(v).trim()),
    z.string().max(2000),
  ),
});

export const env = envSchema.parse(process.env);

/** Provider cloud (não-Ollama) para conversa. */
/** Interpretação de criação usa Ollama por padrão (baterias live sem cloud). */
export function isCreationLlmOllama() {
  return env.CHAT_CREATION_LLM_PROVIDER !== "cloud";
}

export function isCloudChatLlm() {
  return env.CHAT_LLM_PROVIDER === "cloud";
}
