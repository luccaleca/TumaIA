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
    estilo_visual: String(src.estilo_visual ?? "").trim().slice(0, 800),
    evitar: String(src.evitar ?? "").trim().slice(0, 800),
    publico: String(src.publico ?? "").trim().slice(0, 500),
    cor_primaria: normalizeHexColor(src.cor_primaria) || "",
    cor_secundaria: normalizeHexColor(src.cor_secundaria) || "",
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
  const base = normalizeIdentidadeDados(raw && typeof raw === "object" ? raw : {});

  if (palette?.primary) base.cor_primaria = palette.primary;
  if (palette?.secondary) base.cor_secundaria = palette.secondary;

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

  const cores = [base.cor_primaria, base.cor_secundaria].filter(Boolean);
  if (cores.length && base.estilo_visual) {
    const hasHex = /#[0-9A-Fa-f]{3,6}/.test(base.estilo_visual);
    if (!hasHex) {
      base.estilo_visual = `${base.estilo_visual.trim()} Paleta: ${cores.join(", ")}.`.slice(0, 800);
    }
  } else if (cores.length && !base.estilo_visual) {
    base.estilo_visual = `Paleta de marca ${cores.join(" e ")}; visual alinhado ao material enviado.`.slice(
      0,
      800,
    );
  }

  if (!base.evitar) {
    base.evitar = "Copiar layout de posts antigos; fontes ilegíveis; poluição visual.";
  }

  return base;
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
  const cores = [d.cor_primaria, d.cor_secundaria].filter(Boolean);
  if (cores.length) {
    parts.push(`Brand colors (use for background and accents): ${cores.join(", ")}.`);
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
