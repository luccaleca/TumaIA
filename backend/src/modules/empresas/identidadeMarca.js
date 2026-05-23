import { assignRankedPalette } from "../../lib/brandColorScore.js";
import {
  extractCoresMarcaFromLlm,
  mergeBrandPaletteSources,
  sanitizeEstiloVisualText,
  sanitizeIdentidadeLlmOutput,
} from "./identidadeAnaliseLlm.js";

/** Nome fixo do contexto de identidade (um por empresa). */
export const IDENTIDADE_CONTEXTO_NOME = "Identidade da marca";
export const IDENTIDADE_TIPO = "identidade_marca";

const HEX_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

/**
 * @param {unknown} v
 * @returns {string | null}
 */
export function normalizeHexColor(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  if (!s.startsWith("#")) s = `#${s}`;
  if (!HEX_RE.test(s)) return null;
  if (s.length === 4) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    s = `#${r}${r}${g}${g}${b}${b}`;
  }
  return s.toUpperCase();
}

export const CORES_ADICIONAIS_MAX = 4;

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeCoresAdicionais(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of list) {
    const hex = normalizeHexColor(item);
    if (!hex || out.includes(hex)) continue;
    out.push(hex);
    if (out.length >= CORES_ADICIONAIS_MAX) break;
  }
  return out;
}

/**
 * @param {Record<string, unknown>} dados
 * @returns {string[]}
 */
export function allBrandColorsFromIdentidade(dados) {
  const d = normalizeIdentidadeDados(dados || {});
  const seen = new Set();
  const out = [];
  for (const hex of [d.cor_primaria, d.cor_secundaria, ...d.cores_adicionais]) {
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
  }
  return out;
}

/**
 * @param {Record<string, unknown> | null | undefined} row — linha contexto_empresa
 */
export function isIdentidadeMarcaContexto(row) {
  if (!row || typeof row !== "object") return false;
  const schema = row.schema_json;
  const dados = row.dados_json;
  if (schema && typeof schema === "object" && schema.tipo === IDENTIDADE_TIPO) return true;
  if (dados && typeof dados === "object" && dados.tipo === IDENTIDADE_TIPO) return true;
  const nome = String(row.nome ?? "")
    .trim()
    .toLowerCase();
  return nome === IDENTIDADE_CONTEXTO_NOME.toLowerCase();
}

/**
 * @param {Record<string, unknown>} raw
 */
export function normalizeIdentidadeDados(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const tom = src.tom_voz;
  let tom_voz = "";
  if (Array.isArray(tom)) {
    tom_voz = tom.map((x) => String(x).trim()).filter(Boolean).join(", ");
  } else {
    tom_voz = String(tom ?? "").trim();
  }
  return {
    tipo: IDENTIDADE_TIPO,
    sobre_empresa: String(src.sobre_empresa ?? "").trim().slice(0, 2000),
    segmento: String(src.segmento ?? src.segmento_inferido ?? "").trim().slice(0, 200),
    tom_voz: tom_voz.slice(0, 500),
    estilo_visual: sanitizeEstiloVisualText(String(src.estilo_visual ?? "")).slice(0, 800),
    evitar: String(src.evitar ?? "").trim().slice(0, 800),
    publico: String(src.publico ?? "").trim().slice(0, 500),
    cor_primaria: normalizeHexColor(src.cor_primaria) || "",
    cor_secundaria: normalizeHexColor(src.cor_secundaria) || "",
    cores_adicionais: normalizeCoresAdicionais(src.cores_adicionais),
    exemplo_frase_marca: String(src.exemplo_frase_marca ?? src.exemplo_frase ?? "").trim().slice(0, 120),
    site_url: String(src.site_url ?? "").trim().slice(0, 500),
    id_midia_referencia_analise: String(src.id_midia_referencia_analise ?? "").trim() || null,
    id_midia_logo: String(src.id_midia_logo ?? "").trim() || null,
    legenda_referencia: String(src.legenda_referencia ?? "").trim().slice(0, 2000),
  };
}

/**
 * Refina sugestão da análise (texto + coerência com paleta).
 * @param {Record<string, unknown>} raw
 * @param {{ primary?: string | null, secondary?: string | null, accents?: string[] } | null} palette
 * @param {{ nome_fantasia?: string, segmento?: string } | null} [empresaRow]
 */
export function refineIdentidadeFromAnalysis(raw, palette, empresaRow = null) {
  const cleaned = sanitizeIdentidadeLlmOutput(raw && typeof raw === "object" ? raw : {});
  const base = normalizeIdentidadeDados(cleaned);

  const fromPixels = [
    palette?.primary,
    palette?.secondary,
    ...(Array.isArray(palette?.accents) ? palette.accents : []),
  ].filter(Boolean);
  const fromVision = extractCoresMarcaFromLlm(cleaned);
  const fromLlm = [base.cor_primaria, base.cor_secundaria, ...base.cores_adicionais].filter(Boolean);
  const ranked = mergeBrandPaletteSources(
    { vision: fromVision, pixels: fromPixels, legacy: fromLlm },
    2 + CORES_ADICIONAIS_MAX,
  );
  base.cor_primaria = ranked.cor_primaria;
  base.cor_secundaria = ranked.cor_secundaria;
  base.cores_adicionais = ranked.cores_adicionais;

  if (base.tom_voz) {
    base.tom_voz = base.tom_voz
      .split(/[,;|/]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8)
      .join(", ");
  }

  const nome = String(empresaRow?.nome_fantasia ?? "").trim();
  if (!base.sobre_empresa && nome) {
    base.sobre_empresa = `${nome} — negócio local.`.slice(0, 2000);
  }
  if (!base.segmento && empresaRow?.segmento) {
    base.segmento = String(empresaRow.segmento).trim().slice(0, 200);
  }

  if (base.estilo_visual) {
    base.estilo_visual = sanitizeEstiloVisualText(base.estilo_visual).slice(0, 800);
  } else if (allBrandColorsFromIdentidade(base).length) {
    base.estilo_visual = "Visual alinhado ao material enviado (logo e interface).".slice(0, 800);
  }

  if (!base.evitar) {
    base.evitar = "Layout de posts antigos copiado; fontes ilegíveis; poluição visual.";
  }

  return base;
}

/**
 * Une paletas de várias análises (fotos) priorizando verde/azul/neutros sobre marrom de mascote.
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} incoming
 */
export function mergeIdentidadePaletteFields(current, incoming) {
  const cur = normalizeIdentidadeDados(current || {});
  const inc = normalizeIdentidadeDados(incoming || {});
  const hexes = [
    cur.cor_primaria,
    cur.cor_secundaria,
    ...cur.cores_adicionais,
    inc.cor_primaria,
    inc.cor_secundaria,
    ...inc.cores_adicionais,
  ];
  return assignRankedPalette(hexes, 2 + CORES_ADICIONAIS_MAX);
}

/**
 * @param {Record<string, unknown>} dados
 */
export function identidadeCompletude(dados) {
  const d = normalizeIdentidadeDados(dados);
  const checks = [
    { key: "cor_primaria", ok: Boolean(d.cor_primaria) },
    { key: "tom_voz", ok: Boolean(d.tom_voz) },
    { key: "estilo_visual", ok: Boolean(d.estilo_visual) },
    { key: "sobre_empresa", ok: Boolean(d.sobre_empresa) },
  ];
  const done = checks.filter((c) => c.ok).length;
  return {
    percentual: Math.round((done / checks.length) * 100),
    pronto_para_imagem: done >= 2 && Boolean(d.cor_primaria),
    faltando: checks.filter((c) => !c.ok).map((c) => c.key),
  };
}

/**
 * Extrai dados de identidade de uma linha contexto_empresa.
 * @param {Record<string, unknown> | null | undefined} row
 */
export function identidadeFromContextoRow(row) {
  if (!row || !isIdentidadeMarcaContexto(row)) return null;
  const dados = row.dados_json;
  const base = dados && typeof dados === "object" ? dados : {};
  return {
    id_contexto_empresa: row.id_contexto_empresa ?? null,
    nome: String(row.nome ?? IDENTIDADE_CONTEXTO_NOME),
    descricao: String(row.descricao ?? ""),
    dados: normalizeIdentidadeDados(base),
    completude: identidadeCompletude(base),
  };
}

/**
 * Bloco em inglês para FLUX (prioridade alta).
 * @param {Record<string, unknown> | null} dados
 * @param {number} maxLen
 */
export function formatBrandIdentityBlockForFlux(dados, maxLen = 420) {
  const d = normalizeIdentidadeDados(dados || {});
  const parts = [];
  const cores = allBrandColorsFromIdentidade(d);
  if (cores.length) {
    parts.push(`Brand color palette (background, accents, typography): ${cores.join(", ")}.`);
  }
  if (d.estilo_visual) parts.push(`Visual style: ${d.estilo_visual}.`);
  if (d.tom_voz) parts.push(`Tone/mood: ${d.tom_voz}.`);
  if (d.publico) parts.push(`Audience: ${d.publico}.`);
  if (d.evitar) parts.push(`Avoid: ${d.evitar}.`);
  if (d.sobre_empresa) parts.push(`Brand: ${d.sobre_empresa.slice(0, 280)}.`);
  parts.push("Do NOT copy any old post layout or duplicate reference poster design.");
  let s = parts.join(" ");
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 1)}…`;
  return s.trim();
}

/**
 * Identidade resumida para modelos de imagem (poucas palavras + hex).
 * @param {Record<string, unknown> | null} dados
 * @param {number} maxLen
 */
export function formatBrandIdentityCompact(dados, maxLen = 140) {
  const d = normalizeIdentidadeDados(dados || {});
  const cores = allBrandColorsFromIdentidade(d).slice(0, 5);
  const styleRaw = String(d.estilo_visual ?? "")
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  const parts = [];
  if (cores.length) parts.push(`colors ${cores.join(" ")}`);
  if (styleRaw) parts.push(styleRaw.slice(0, 72));
  let s = parts.join(", ");
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 1)}…`;
  return s.trim();
}

/**
 * @param {Array<Record<string, unknown>>} contextoRows
 */
export function partitionContextosIdentidade(contextoRows) {
  const identidadeRow = (contextoRows || []).find((r) => isIdentidadeMarcaContexto(r)) || null;
  const campanhaRows = (contextoRows || []).filter((r) => !isIdentidadeMarcaContexto(r));
  const identidadeDados = identidadeRow
    ? normalizeIdentidadeDados(
        identidadeRow.dados_json && typeof identidadeRow.dados_json === "object"
          ? identidadeRow.dados_json
          : {},
      )
    : null;
  return { identidadeRow, identidadeDados, campanhaRows };
}
