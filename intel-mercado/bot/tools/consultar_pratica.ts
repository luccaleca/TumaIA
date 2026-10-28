import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { lerNotas, resumirLista, vigenteEm } from "../lib/caderno.js";

export default defineTool({
  description:
    "Lê as anotações já checadas. Use antes de dizer o que você já sabe. Passe slug para uma nota, ou tema para filtrar. Sem os dois, devolve as que ainda estão no prazo.",
  effect: "read",
  inputSchema: z.object({
    slug: z.string().min(2).max(48).optional(),
    tema: z.string().min(2).max(80).optional(),
    incluirVencidas: z.boolean().optional(),
  }),
  async execute({ slug, tema, incluirVencidas }, ctx) {
    const agoraMs = Date.now();
    const todas = await lerNotas(ctx.host.kv);
    const porSlug = slug ? todas.filter((nota) => nota.slug === slug) : todas;
    const porTema = tema
      ? porSlug.filter((nota) => nota.tema.toLowerCase().includes(tema.toLowerCase()))
      : porSlug;
    const soVigentes = incluirVencidas !== true && !slug;
    const notas = soVigentes ? porTema.filter((nota) => vigenteEm(nota, agoraMs)) : porTema;
    const lista = resumirLista(notas, agoraMs);
    return {
      agora: new Date(agoraMs).toISOString(),
      encontrada: notas.length > 0,
      filtro: {
        slug: slug ?? null,
        tema: tema ?? null,
        incluirVencidas: incluirVencidas === true || Boolean(slug),
      },
      ...lista,
    };
  },
});
