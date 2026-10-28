import type { HostKvApi } from "@grok/agent-sdk";

export const CADERNO_KEY = "caderno:notas";
export const MAX_NOTAS = 40;
const LISTA_MAX = 12;

export type Fonte = {
  titulo: string;
  url?: string;
};

export type NotaPratica = {
  slug: string;
  tema: string;
  resumo: string;
  metodoDuravel: string;
  ferramentaDatada: string;
  fontes: Fonte[];
  verificadoEm: string;
  validoAte: string;
};

export type KvCaderno = Pick<HostKvApi, "get" | "put">;

const ISO_COM_FUSO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isoComFuso(value: string): boolean {
  if (!ISO_COM_FUSO.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

export function vigenteEm(nota: NotaPratica, agoraMs: number): boolean {
  const ate = Date.parse(nota.validoAte);
  return Number.isFinite(ate) && ate >= agoraMs;
}

function fonteOk(value: unknown): value is Fonte {
  if (!value || typeof value !== "object") return false;
  const fonte = value as Record<string, unknown>;
  if (typeof fonte.titulo !== "string" || fonte.titulo.length === 0) return false;
  if (fonte.url !== undefined && typeof fonte.url !== "string") return false;
  return true;
}

function notaOk(value: unknown): value is NotaPratica {
  if (!value || typeof value !== "object") return false;
  const nota = value as Record<string, unknown>;
  return (
    typeof nota.slug === "string" &&
    typeof nota.tema === "string" &&
    typeof nota.resumo === "string" &&
    typeof nota.metodoDuravel === "string" &&
    typeof nota.ferramentaDatada === "string" &&
    typeof nota.verificadoEm === "string" &&
    typeof nota.validoAte === "string" &&
    Array.isArray(nota.fontes) &&
    nota.fontes.every(fonteOk)
  );
}

export async function lerNotas(kv: KvCaderno): Promise<NotaPratica[]> {
  const raw = await kv.get(CADERNO_KEY);
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || !raw.every(notaOk)) {
    throw new Error("caderno ilegível; não vou sobrescrever");
  }
  return raw;
}

export async function gravarNota(kv: KvCaderno, nota: NotaPratica): Promise<number> {
  const notas = (await lerNotas(kv)).filter((item) => item.slug !== nota.slug);
  notas.push(nota);
  notas.sort((a, b) => Date.parse(a.verificadoEm) - Date.parse(b.verificadoEm));
  const cortadas = notas.length > MAX_NOTAS ? notas.slice(notas.length - MAX_NOTAS) : notas;
  await kv.put(CADERNO_KEY, cortadas);
  return cortadas.length;
}

export function resumirLista(notas: NotaPratica[], agoraMs: number) {
  const ordenadas = [...notas].sort(
    (a, b) => Date.parse(b.verificadoEm) - Date.parse(a.verificadoEm),
  );
  const visiveis = ordenadas.slice(0, LISTA_MAX);
  return {
    total: ordenadas.length,
    omitidas: Math.max(0, ordenadas.length - visiveis.length),
    notas: visiveis.map((nota) => ({
      slug: nota.slug,
      tema: nota.tema,
      resumo: nota.resumo,
      metodoDuravel: nota.metodoDuravel,
      ferramentaDatada: nota.ferramentaDatada,
      fontes: nota.fontes,
      verificadoEm: nota.verificadoEm,
      validoAte: nota.validoAte,
      vigente: vigenteEm(nota, agoraMs),
    })),
  };
}
