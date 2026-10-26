import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  name: "Intel Mercado",
  description:
    "Guia de um júnior de inteligência de mercado na EHTL. O setor usa dashboard, e-mail e SharePoint. SQL e Python ficam atrás do painel.",
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
  tools: ["webSearch", "webFetch", "read", "grep", "glob", "ls"],
});
