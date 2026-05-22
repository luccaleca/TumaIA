import { assignRankedPalette, normalizeHexColor } from "../../lib/brandColorScore.js";

/** Trechos típicos quando o modelo repete instruções do sistema no campo evitar/estilo. */
const PROMPT_LEAK_RE = [
  /mascote/i,
  /não confunda/i,
  /priorize cores/i,
  /paleta da marca/i,
  /interface e da marca/i,
  /pele,?\s*pelo/i,
  /quando forem ru[ií]do/i,
  /destaques saturados do layout/i,
  /neutros\s*\(/i,
  /cores do logotipo/i,
  /ignore cores/i,
  /ilustrado ou fotos/i,
];

/**
 * @param {string} text
 */
export function isIdentidadePromptLeak(text) {
  const t = String(text ?? "").trim();
  if (!t || t.length < 24) return false;
  return PROMPT_LEAK_RE.some((re) => re.test(t));
}

/** Nomes de cor — ficam só em cor_primaria / cor_secundaria / cores_adicionais. */
const COLOR_NAME_RE =
  /\b(verde|azul|branc[oa]s?|pret[oa]s?|cinz[ea]s?|marrom|amarel[oa]s?|laranj[ae]s?|rox[oa]s?|ros[ae]s?|vermelh[oa]s?|bege|dourad[oa]s?|prat[ae]s?|turquesa|ciano|magenta|vinho|corals?|marfim|índigo|indigo|navy|teal|amber|néon|neon|green|blue|whites?|blacks?|gr[ae]ys?|browns?|yellows?|oranges?|purples?|pinks?|reds?|gold|silver)\b/gi;

/**
 * Remove hex, "Paleta: …" e nomes de cor do campo estilo_visual.
 * @param {string} text
 */
export function sanitizeEstiloVisualText(text) {
  let s = String(text ?? "")
    .replace(/\s*Paleta:\s*#[0-9A-Fa-f]{3,6}(?:\s*,\s*#[0-9A-Fa-f]{3,6})*\.?/gi, "")
    .replace(/\s*paleta de marca\s*#[0-9A-Fa-f]{3,6}(?:\s*,\s*#[0-9A-Fa-f]{3,6})*/gi, "")
    .replace(/#[0-9A-Fa-f]{3,8}\b/gi, "")
    .replace(/\bcores?\s+(?:de\s+)?/gi, "")
    .replace(COLOR_NAME_RE, "");

  s = s
    .replace(/[,;|/]+/g, ",")
    .split(",")
    .map((part) =>
      part
        .replace(/\s+/g, " ")
        .replace(/^\s*(e|ou|com|de|da|do)\s+/gi, "")
        .replace(/\s+(e|ou|com|de|da|do)\s*$/gi, "")
        .trim(),
    )
    .filter((part) => part && !/^(e|ou)$/i.test(part))
    .join(", ");

  return s.replace(/\s{2,}/g, " ").replace(/\.+$/g, "").trim();
}

/** @deprecated Use sanitizeEstiloVisualText */
export function stripPaletaFromEstiloVisual(text) {
  return sanitizeEstiloVisualText(text);
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function extractCoresMarcaFromLlm(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  /** @type {string[]} */
  const out = [];
  const push = (v) => {
    const hex = normalizeHexColor(v);
    if (!hex || out.includes(hex)) return;
    out.push(hex);
  };

  const arr = src.cores_marca ?? src.coresMarca ?? src.palette ?? src.paleta;
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object" && "hex" in item) push(item.hex);
    }
  }

  push(src.cor_primaria);
  push(src.cor_secundaria);
  if (Array.isArray(src.cores_adicionais)) {
    for (const c of src.cores_adicionais) push(c);
  }

  return out.slice(0, 8);
}

/**
 * Limpa saída do LLM antes de normalizar/refinar (evita vazamento de prompt).
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
export function sanitizeIdentidadeLlmOutput(raw) {
  const src = raw && typeof raw === "object" ? { ...raw } : {};

  if (typeof src.evitar === "string" && isIdentidadePromptLeak(src.evitar)) {
    src.evitar = "";
  }

  if (typeof src.estilo_visual === "string") {
    let est = sanitizeEstiloVisualText(src.estilo_visual);
    if (isIdentidadePromptLeak(est)) est = "";
    src.estilo_visual = est;
  }

  return src;
}

/**
 * Mescla cores da visão (prioridade), pixels e campos legados.
 * @param {{ vision?: string[], pixels?: string[], legacy?: string[] }} sources
 * @param {number} [max]
 */
export function mergeBrandPaletteSources(sources, max = 6) {
  /** @type {string[]} */
  const weighted = [];
  const add = (list, times = 1) => {
    for (const h of list || []) {
      const hex = normalizeHexColor(h);
      if (!hex) continue;
      for (let i = 0; i < times; i++) weighted.push(hex);
    }
  };
  add(sources.vision, 4);
  add(sources.legacy, 2);
  add(sources.pixels, 1);
  return assignRankedPalette(weighted, max);
}
