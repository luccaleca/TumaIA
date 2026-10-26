import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { gravarNota, isoComFuso, type NotaPratica } from "../lib/caderno.js";

const DIA_MS = 24 * 60 * 60 * 1000;

export default defineTool({
  description:
    "Grava ou substitui uma nota do caderno, pela mesma slug. Só depois de fonte conferida. verificadoEm é ISO-8601 com fuso. validadeDias vale 7 a 180. Repetir os mesmos argumentos não duplica a nota.",
  effect: "idempotent",
  inputSchema: z.object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    tema: z.string().min(2).max(80),
    resumo: z.string().min(40).max(700),
    metodoDuravel: z.string().min(40).max(900),
    ferramentaDatada: z.string().min(20).max(700),
    fontes: z
      .array(
        z.object({
          titulo: z.string().min(3).max(160),
          url: z.string().url().max(300).optional(),
        }),
      )
      .min(1)
      .max(5),
    verificadoEm: z.string(),
    validadeDias: z.number().int().min(7).max(180).optional(),
  }),
  async execute(input, ctx) {
    if (!isoComFuso(input.verificadoEm)) {
      throw new Error("verificadoEm precisa ser ISO-8601 com fuso, como 2026-10-26T12:00:00Z");
    }
    const verificadoMs = Date.parse(input.verificadoEm);
    const agora = Date.now();
    if (verificadoMs > agora + 36 * 60 * 60 * 1000) {
      throw new Error("verificadoEm está no futuro");
    }
    if (verificadoMs < agora - 10 * 365 * DIA_MS) {
      throw new Error("verificadoEm está antigo demais");
    }
    const validadeDias = input.validadeDias ?? 45;
    const nota: NotaPratica = {
      slug: input.slug,
      tema: input.tema,
      resumo: input.resumo,
      metodoDuravel: input.metodoDuravel,
      ferramentaDatada: input.ferramentaDatada,
      fontes: input.fontes.map((fonte) =>
        fonte.url ? { titulo: fonte.titulo, url: fonte.url } : { titulo: fonte.titulo },
      ),
      verificadoEm: input.verificadoEm,
      validoAte: new Date(verificadoMs + validadeDias * DIA_MS).toISOString(),
    };
    const total = await gravarNota(ctx.host.kv, nota);
    return {
      ok: true,
      slug: nota.slug,
      verificadoEm: nota.verificadoEm,
      validoAte: nota.validoAte,
      total,
    };
  },
});
