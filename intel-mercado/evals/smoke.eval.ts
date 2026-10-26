import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "Consulta o caderno e não registra nem pesquisa quando o pedido é só leitura.",
  async test(t) {
    await t.send(
      "Consulta o caderno de práticas no slug preco-share. Responda se existe nota vigente. Não registre nada e não pesquise na web.",
    );
    t.succeeded();
    t.calledTool("consultar_pratica", {
      input: { slug: "preco-share" },
    });
    t.notCalledTool("registrar_pratica");
    t.notCalledTool("webSearch");
    t.notCalledTool("webFetch");
  },
});
