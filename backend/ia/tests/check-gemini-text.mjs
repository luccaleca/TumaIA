import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
if (!apiKey) {
  console.error("Erro: configure GEMINI_API_KEY ou GOOGLE_AI_API_KEY no .env");
  process.exit(1);
}

const model = "gemini-2.5-flash";
const url =
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
  `?key=${encodeURIComponent(apiKey)}`;

const body = {
  contents: [
    {
      parts: [
        {
          text: "Responda somente com este JSON: {\"ok\":true,\"tipo\":\"texto\"}",
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.2,
  },
};

try {
  const startedAt = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const elapsedMs = Date.now() - startedAt;
  const payload = await response.json();

  if (!response.ok) {
    const msg = payload?.error?.message || `HTTP ${response.status}`;
    const status = payload?.error?.status || "UNKNOWN";
    const details = payload?.error?.details || [];
    const quotaHints = JSON.stringify(details);
    console.error("Falha na chamada Gemini.");
    console.error(`status=${status} http=${response.status}`);
    console.error(`mensagem=${msg}`);
    if (quotaHints.includes("free_tier") || quotaHints.includes("QuotaFailure")) {
      console.error("Diagnóstico: quota estourada (verifique se é quota de texto ou imagem).");
    }
    process.exit(2);
  }

  const usedModel = payload?.modelVersion || model;
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usageMetadata = payload?.usageMetadata || {};
  const inputTokens = Number(usageMetadata.promptTokenCount || 0);
  const outputTokens = Number(usageMetadata.candidatesTokenCount || 0);
  const totalTokens = Number(usageMetadata.totalTokenCount || 0);
  console.log("Gemini texto OK.");
  console.log(`modelo=${usedModel}`);
  console.log(`latencia_ms=${elapsedMs}`);
  console.log(`tokens_entrada=${inputTokens}`);
  console.log(`tokens_saida=${outputTokens}`);
  console.log(`tokens_total=${totalTokens}`);
  console.log("amostra_resposta:");
  console.log(text.slice(0, 300));
} catch (err) {
  console.error("Erro de rede/chamada:", err instanceof Error ? err.message : String(err));
  process.exit(3);
}

