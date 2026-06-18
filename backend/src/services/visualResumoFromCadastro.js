import {
  formatProductDisplayName,
  intentLooksPromotional,
  isGenericMidiaWhy,
  isMeaningfulCadastroValue,
} from "./cadastroMeaningful.js";

/**
 * Ambiente e props a partir do cadastro — segmento, identidade e metadados das mídias.
 *
 * @param {Record<string, unknown> | null | undefined} empresaRow
 * @param {Record<string, unknown> | null | undefined} identidadeDados
 * @param {Array<Record<string, unknown>>} [referencedMidias]
 */
export function describeAmbienteFromCadastro(empresaRow, identidadeDados, referencedMidias = []) {
  const parts = [];
  const segmento = String(identidadeDados?.segmento || empresaRow?.segmento || "").trim();
  const sobre = String(identidadeDados?.sobre_empresa || empresaRow?.descricao || "").trim();
  const publico = String(identidadeDados?.publico || "").trim();
  const estilo = String(identidadeDados?.estilo_visual || "").trim();

  const refs = Array.isArray(referencedMidias) ? referencedMidias : [];
  for (const m of refs.slice(0, 3)) {
    const nome = formatProductDisplayName(m?.nome_exibicao ?? m?.nome_arquivo ?? "");
    const meta = [m?.descricao, m?.alt_text, m?.why]
      .map((s) => String(s ?? "").trim())
      .filter((s) => s && !isGenericMidiaWhy(s))
      .join(" — ");
    if (meta) {
      parts.push(`Detalhes visuais de ${nome || "o produto"}: ${meta.slice(0, 180)}.`);
    }
  }

  if (segmento && isMeaningfulCadastroValue("segmento", segmento)) {
    parts.push(
      `Cenário e detalhes coerentes com um negócio de ${segmento}, reforçando o produto sem poluir o centro.`,
    );
  } else if (sobre && isMeaningfulCadastroValue("sobre", sobre)) {
    parts.push(`Ambientação alinhada ao perfil da empresa: ${sobre.slice(0, 160)}.`);
  }

  if (publico && isMeaningfulCadastroValue("publico", publico)) {
    parts.push(`Visual pensado para ${publico}.`);
  }
  if (estilo && isMeaningfulCadastroValue("estilo_visual", estilo)) {
    const e = estilo.charAt(0).toUpperCase() + estilo.slice(1);
    parts.push(e.endsWith(".") ? e : `${e}.`);
  }

  const variacoes = String(identidadeDados?.variacoes_campanha || "").trim();
  if (variacoes && parts.length < 4) {
    parts.push(variacoes.slice(0, 160));
  }

  if (!parts.length) {
    return "Elementos de apoio sutis ao redor que combinem com o produto e a marca cadastrada.";
  }
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 360);
}
