import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  name: "Intel Mercado",
  description:
    "Guia de um júnior em inteligência de mercado. Mostra o jeito que um analista bom trabalha, o que vale aprender agora e o que pode pular.",
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
  tools: ["webSearch", "webFetch", "read", "grep", "glob", "ls"],
});
