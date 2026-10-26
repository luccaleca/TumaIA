import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  name: "Intel Mercado",
  description:
    "Especialista em análise de dados para inteligência de mercado. Separa método durável de ferramenta datada e guarda no caderno o que foi verificado.",
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
  tools: ["webSearch", "webFetch", "read", "grep", "glob", "ls"],
});
