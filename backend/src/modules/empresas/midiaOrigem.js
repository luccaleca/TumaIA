/** Pasta interna — não listada no painel de Mídias. */
export const PASTA_IDENTIDADE_MARCA_NOME = "Identidade da marca";

export const ORIGEM_UPLOAD_MANUAL = "upload_manual";
export const ORIGEM_UPLOAD_IDENTIDADE_FOTO = "identidade_marca_foto";
export const ORIGEM_UPLOAD_IDENTIDADE_LOGO = "identidade_marca_logo";

/** Lado maior mínimo para logo na identidade (artes / FLUX). */
export const LOGO_IDENTIDADE_MIN_LADO_MAIOR_PX = 512;

/** Tamanho recomendado exibido na UI. */
export const LOGO_IDENTIDADE_IDEAL_LADO_MAIOR_PX = 1024;

const ORIGENS_IDENTIDADE = new Set([ORIGEM_UPLOAD_IDENTIDADE_FOTO, ORIGEM_UPLOAD_IDENTIDADE_LOGO]);

/**
 * @param {number} width
 * @param {number} height
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateLogoIdentidadeDimensions(width, height) {
  const w = Math.max(0, Math.round(Number(width) || 0));
  const h = Math.max(0, Math.round(Number(height) || 0));
  if (w < 1 || h < 1) {
    return { ok: false, error: "Não foi possível ler o tamanho da imagem." };
  }
  const ladoMaior = Math.max(w, h);
  if (ladoMaior < LOGO_IDENTIDADE_MIN_LADO_MAIOR_PX) {
    return {
      ok: false,
      error: `Logo muito pequena (${w}×${h} px). Use PNG sem fundo com pelo menos ${LOGO_IDENTIDADE_MIN_LADO_MAIOR_PX} px no lado maior (ideal ${LOGO_IDENTIDADE_IDEAL_LADO_MAIOR_PX} px) para ficar nítida nas artes.`,
    };
  }
  return { ok: true };
}

/**
 * @param {string | null | undefined} origem
 */
export function isOrigemUploadIdentidade(origem) {
  return ORIGENS_IDENTIDADE.has(String(origem || "").trim());
}

/**
 * @param {Record<string, unknown>} row
 */
export function isMidiaRowIdentidade(row) {
  return isOrigemUploadIdentidade(row?.origem_upload);
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function filterMidiasAcervo(rows) {
  return (rows || []).filter((r) => !isMidiaRowIdentidade(r));
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function filterMidiasIdentidade(rows) {
  return (rows || []).filter((r) => isMidiaRowIdentidade(r));
}
