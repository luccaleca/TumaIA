/** Espelha `backend/src/services/arteFormatPresets.js` */

export const ARTE_FORMAT_PRESETS = [
  {
    id: "post_square",
    ratio: "1:1",
    label: "Post",
    subtitle: "Carrossel",
    pixels: "1080×1080",
    orientation: "square",
    hint: "Instagram feed quadrado",
  },
  {
    id: "feed_portrait",
    ratio: "4:5",
    label: "Feed",
    subtitle: "Retrato",
    pixels: "1080×1350",
    orientation: "portrait",
    hint: "Instagram feed vertical",
  },
  {
    id: "stories",
    ratio: "9:16",
    label: "Stories",
    subtitle: "Reels",
    pixels: "1080×1920",
    orientation: "portrait_tall",
    hint: "Stories, Reels, TikTok",
  },
  {
    id: "landscape",
    ratio: "16:9",
    label: "Paisagem",
    subtitle: "YouTube",
    pixels: "1920×1080",
    orientation: "landscape_wide",
    hint: "Capa, banner, thumbnail",
  },
  {
    id: "photo_h",
    ratio: "3:2",
    label: "Foto",
    subtitle: "Horizontal",
    pixels: "—",
    orientation: "landscape",
  },
  {
    id: "photo_v",
    ratio: "2:3",
    label: "Foto",
    subtitle: "Vertical",
    pixels: "—",
    orientation: "portrait",
  },
  {
    id: "classic",
    ratio: "4:3",
    label: "Clássico",
    subtitle: "4:3",
    pixels: "—",
    orientation: "landscape",
  },
];

export const DEFAULT_FORMAT_PRESET_ID = "post_square";

const PRESET_BY_ID = new Map(ARTE_FORMAT_PRESETS.map((p) => [p.id, p]));
const PRESET_BY_RATIO = new Map(ARTE_FORMAT_PRESETS.map((p) => [p.ratio, p]));

export function getFormatPresetById(id) {
  return PRESET_BY_ID.get(String(id || "").trim()) || PRESET_BY_ID.get(DEFAULT_FORMAT_PRESET_ID);
}

export function getFormatPresetByRatio(ratio) {
  const r = String(ratio || "").trim();
  return PRESET_BY_RATIO.get(r) || null;
}

/**
 * @param {string} text
 * @returns {typeof ARTE_FORMAT_PRESETS[number] | null}
 */
export function tryDetectFormatPresetFromText(text) {
  const t = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  if (/\b(9\s*[:x]\s*16|9x16|1080\s*[x×]\s*1920)\b/.test(t) || /\b(stories?|story|reels?)\b/.test(t)) {
    return getFormatPresetById("stories");
  }
  if (/\b(1\s*[:x]\s*1|1x1|1080\s*[x×]\s*1080)\b/.test(t) || /\b(quadrado|carrossel|carousel)\b/.test(t)) {
    return getFormatPresetById("post_square");
  }
  if (/\b(4\s*[:x]\s*5|4x5|1080\s*[x×]\s*1350)\b/.test(t) || /\bfeed\s*retrato\b/.test(t)) {
    return getFormatPresetById("feed_portrait");
  }
  if (
    /\b(16\s*[:x]\s*9|16x9)\b/.test(t) ||
    /\b(youtube|paisagem|thumbnail|thumb\b)\b/.test(t) ||
    /\bvers[aã]o\s+16\b/.test(t) ||
    /\bformato\s+16\b/.test(t)
  ) {
    return getFormatPresetById("landscape");
  }
  if (/\b(2\s*[:x]\s*3|2x3)\b/.test(t)) return getFormatPresetById("photo_v");
  if (/\b(3\s*[:x]\s*2|3x2)\b/.test(t)) return getFormatPresetById("photo_h");
  if (/\b(4\s*[:x]\s*3|4x3)\b/.test(t) || /\bclassico\b/.test(t)) return getFormatPresetById("classic");
  return null;
}

export function formatoToJson(preset) {
  return {
    preset_id: preset.id,
    ratio: preset.ratio,
    label: preset.label,
    subtitle: preset.subtitle,
    pixels: preset.pixels,
    orientation: preset.orientation,
  };
}

export function emptyArteBrief(brandColors = []) {
  const preset = getFormatPresetById(DEFAULT_FORMAT_PRESET_ID);
  const cores = Array.isArray(brandColors) ? brandColors.filter(Boolean).slice(0, 5) : [];
  return {
    tema: "",
    formato: {
      preset_id: preset.id,
      ratio: preset.ratio,
      label: preset.label,
      subtitle: preset.subtitle,
      pixels: preset.pixels,
      orientation: preset.orientation,
    },
    cores,
    titulo: "",
    subtitulo: "",
    texto: "",
    rede: "instagram",
    estilo: "",
    observacoes: "",
  };
}

export function normalizeArteBrief(raw, brandColors = []) {
  const base = emptyArteBrief(brandColors);
  if (!raw || typeof raw !== "object") return base;
  const preset = getFormatPresetById(raw.formato?.preset_id || raw.formato?.id);
  return {
    tema: String(raw.tema ?? base.tema).trim(),
    formato: {
      preset_id: String(raw.formato?.preset_id ?? preset.id),
      ratio: String(raw.formato?.ratio ?? preset.ratio),
      label: String(raw.formato?.label ?? preset.label),
      subtitle: String(raw.formato?.subtitle ?? preset.subtitle),
      pixels: String(raw.formato?.pixels ?? preset.pixels),
      orientation: raw.formato?.orientation ?? preset.orientation,
    },
    cores: Array.isArray(raw.cores) ? raw.cores.filter(Boolean).slice(0, 5) : base.cores,
    titulo: String(raw.titulo ?? "").trim(),
    subtitulo: String(raw.subtitulo ?? "").trim(),
    texto: String(raw.texto ?? "").trim(),
    rede: String(raw.rede ?? base.rede).trim() || base.rede,
    estilo: String(raw.estilo ?? "").trim(),
    observacoes: String(raw.observacoes ?? "").trim(),
  };
}

export function arteBriefReady(brief) {
  return Boolean(String(brief?.tema ?? "").trim());
}
