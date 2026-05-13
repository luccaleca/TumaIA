import "dotenv/config";

function baseV1() {
  const raw = (process.env.LLAMA_BASE_URL || "http://127.0.0.1:11434/v1").trim().replace(/\/+$/, "");
  if (!raw) return "http://127.0.0.1:11434/v1";
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

const model = (process.env.LLAMA_MODEL || "llama3.2:3b").trim();
const apiKey = (process.env.LLAMA_API_KEY || "ollama").trim() || "ollama";
const url = `${baseV1()}/chat/completions`;

const body = {
  model,
  messages: [
    {
      role: "user",
      content: 'Responda somente com este JSON: {"ok":true,"tipo":"texto"}',
    },
  ],
  temperature: 0.2,
};

try {
  const startedAt = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const elapsedMs = Date.now() - startedAt;
  const payload = await response.json();

  if (!response.ok) {
    const msg = payload?.error?.message || payload?.error || `HTTP ${response.status}`;
    console.error("Falha na chamada Llama (API OpenAI-compatível).");
    console.error(`http=${response.status}`);
    console.error(`mensagem=${msg}`);
    process.exit(2);
  }

  const usedModel = payload?.model || model;
  const text = payload?.choices?.[0]?.message?.content || "";
  const u = payload?.usage || {};
  const inputTokens = Number(u.prompt_tokens || 0);
  const outputTokens = Number(u.completion_tokens || 0);
  const totalTokens = Number(u.total_tokens || 0);
  console.log("Llama texto OK.");
  console.log(`modelo=${usedModel}`);
  console.log(`latencia_ms=${elapsedMs}`);
  console.log(`tokens_entrada=${inputTokens}`);
  console.log(`tokens_saida=${outputTokens}`);
  console.log(`tokens_total=${totalTokens}`);
  console.log("amostra_resposta:");
  console.log(String(text).slice(0, 300));
} catch (err) {
  console.error("Erro de rede/chamada:", err instanceof Error ? err.message : String(err));
  process.exit(3);
}
