/**
 * Agente da marca — papel livre do usuário + campos essenciais da imagem.
 * O papel em branco é o miolo; logo/paleta/estilo/evitar travam a arte.
 */

import {
  EVITAR_PADRAO_IMAGEM,
  allBrandColorsFromIdentidade,
  identidadeCompletude,
  identidadeFromContextoRow,
  normalizeIdentidadeDados,
} from "../modules/empresas/identidadeMarca.js";
import { findIdentidadeContextoRow } from "./identidadeMarcaService.js";

/**
 * @param {Record<string, unknown> | null | undefined} identidadeDados
 * @param {{
 *   nome_fantasia?: string | null,
 *   descricao?: string | null,
 *   segmento?: string | null,
 * } | null} [empresaRow]
 */
export function renderAgenteMarcaMarkdown(identidadeDados, empresaRow = null) {
  const d = normalizeIdentidadeDados(identidadeDados || {});
  const nome =
    String(empresaRow?.nome_fantasia || "").trim() ||
    String(d.sobre_empresa || "").trim().slice(0, 60) ||
    "a empresa";
  const cores = allBrandColorsFromIdentidade(d);
  const evitar = String(d.evitar || "").trim() || EVITAR_PADRAO_IMAGEM;
  const papel = String(d.papel_agente || "").trim();

  const lines = [
    `# ${nome}`,
    "",
    "Você representa esta marca no TumaIA (chat, briefing e artes).",
    "Se o pedido conflitar com o que está abaixo, a marca vence — ajuste e diga em 1 frase.",
    "",
    "## Para toda arte (obrigatório)",
    `- Não inventar logo, cores ou produtos fora do treino/acervo.`,
    cores.length
      ? `- Paleta obrigatória: ${cores.join(", ")}.`
      : `- Paleta ainda não definida — não inventar cores de marca.`,
    d.estilo_visual ? `- Estilo visual: ${d.estilo_visual}.` : null,
    d.assinatura_visual ? `- Assinatura visual: ${d.assinatura_visual}.` : null,
    `- Evitar: ${evitar}.`,
    d.id_midia_logo
      ? `- Logo oficial do acervo (marca d'água discreta). Nunca inventar logotipo.`
      : `- Sem logo cadastrada — não inventar logotipo.`,
    `- PNG do acervo: preservar embalagem/rótulo — não redesenhar.`,
    `- Textos: criar no tom da marca; não colar sempre a mesma frase.`,
    "",
  ].filter((x) => x != null);

  if (papel) {
    lines.push(
      "## Papel da marca (escrito pela equipe)",
      "Leia e obedeça o texto abaixo como a voz e as regras da marca:",
      "",
      papel,
      "",
    );
  } else {
    lines.push(
      "## Papel da marca",
      "(Ainda vazio — use os campos de estilo/paleta acima até a equipe escrever o papel.)",
      "",
    );
  }

  if (d.tom_voz) lines.push("## Tom", d.tom_voz, "");
  if (d.exemplo_frase_marca) {
    lines.push(
      "## Estilo de headline (referência)",
      `«${d.exemplo_frase_marca}» — criar variação nova, não copiar literal.`,
      "",
    );
  }
  if (d.regras_repeticao) lines.push("## Layout", d.regras_repeticao, "");
  if (d.variacoes_campanha) lines.push("## Variações", d.variacoes_campanha, "");
  if (d.estrategia_cor_campanha) lines.push("## Cor por campanha", d.estrategia_cor_campanha, "");
  if (d.sobre_empresa) lines.push("## Sobre", d.sobre_empresa, "");
  if (d.segmento) lines.push("## Segmento", d.segmento, "");
  if (d.publico) lines.push("## Público", d.publico, "");
  if (d.legenda_referencia) lines.push("## Legenda de referência", d.legenda_referencia.slice(0, 600), "");

  return lines.join("\n").trim();
}

/**
 * @param {Record<string, unknown> | null | undefined} identidadeDados
 */
export function brandAgentStatus(identidadeDados) {
  const d = normalizeIdentidadeDados(identidadeDados || {});
  const comp = identidadeCompletude(d);
  const temPapel = String(d.papel_agente || "").trim().length >= 40;
  const camposTreino = [
    Boolean(d.id_midia_logo),
    Boolean(d.cor_primaria),
    Boolean(d.estilo_visual) || Boolean(d.assinatura_visual) || temPapel,
    temPapel,
  ];
  const preenchidos = camposTreino.filter(Boolean).length;
  return {
    ...comp,
    campos_treino: camposTreino.length,
    campos_treino_ok: preenchidos,
    agente_inicial_ok: Boolean(d.id_midia_logo && d.cor_primaria && (d.estilo_visual || temPapel)),
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 */
export async function getAgenteMarcaForEmpresa(supabase, idEmpresa) {
  const row = await findIdentidadeContextoRow(supabase, idEmpresa);
  const parsed = identidadeFromContextoRow(row);
  const dados = parsed?.dados || normalizeIdentidadeDados({});

  const { data: empresaRow } = await supabase
    .from("empresa")
    .select("nome_fantasia, descricao, segmento")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();

  const markdown = renderAgenteMarcaMarkdown(dados, empresaRow);
  const status = brandAgentStatus(dados);

  return {
    id_empresa: idEmpresa,
    id_contexto_empresa: parsed?.id_contexto_empresa ?? null,
    nome_fantasia: empresaRow?.nome_fantasia ?? null,
    dados,
    markdown,
    status,
  };
}

/**
 * @param {string} markdown
 * @param {number} [maxLen]
 */
export function clipAgenteMarcaForPrompt(markdown, maxLen = 3500) {
  const s = String(markdown || "").trim();
  if (!s) return "";
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}
