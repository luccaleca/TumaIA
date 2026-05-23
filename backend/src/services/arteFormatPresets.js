/** @typedef {"square" | "portrait" | "portrait_tall" | "landscape" | "landscape_wide"} FormatOrientation */

/**
 * @typedef {{
 *   id: string,
 *   ratio: string,
 *   label: string,
 *   subtitle: string,
 *   pixels: string,
 *   orientation: FormatOrientation,
 *   hint?: string,
 * }} ArteFormatPreset
 */

/** @type {ArteFormatPreset[]} */
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

const PRESET_BY_ID = new Map(ARTE_FORMAT_PRESETS.map((p) => [p.id, p]));
const PRESET_BY_RATIO = new Map(ARTE_FORMAT_PRESETS.map((p) => [p.ratio, p]));

export const DEFAULT_FORMAT_PRESET_ID = "post_square";

/**
 * @param {string} id
 * @returns {ArteFormatPreset}
 */
export function getFormatPresetById(id) {
  return PRESET_BY_ID.get(String(id || "").trim()) || PRESET_BY_ID.get(DEFAULT_FORMAT_PRESET_ID);
}

/**
 * @param {string} ratio
 * @returns {ArteFormatPreset | null}
 */
export function getFormatPresetByRatio(ratio) {
  const r = String(ratio || "").trim();
  return PRESET_BY_RATIO.get(r) || null;
}

/**
 * @param {unknown} raw
 * @returns {ArteFormatPreset}
 */
export function normalizeFormatoFromRaw(raw) {
  if (!raw || typeof raw !== "object") return getFormatPresetById(DEFAULT_FORMAT_PRESET_ID);
  const id = String(raw.preset_id ?? raw.id ?? "").trim();
  if (id && PRESET_BY_ID.has(id)) {
    const p = PRESET_BY_ID.get(id);
    return {
      ...p,
      ratio: String(raw.ratio ?? p.ratio).trim() || p.ratio,
      label: String(raw.label ?? p.label).trim() || p.label,
      pixels: String(raw.pixels ?? p.pixels).trim() || p.pixels,
    };
  }
  const ratio = String(raw.ratio ?? "").trim();
  const byRatio = ratio ? getFormatPresetByRatio(ratio) : null;
  if (byRatio) return { ...byRatio };
  return getFormatPresetById(DEFAULT_FORMAT_PRESET_ID);
}

/**
 * @param {string} text
 * @returns {ArteFormatPreset}
 */
export function detectFormatPresetFromText(text) {
  const t = String(text || "").toLowerCase();
  if (/stories|story\b|reels?\b|9\s*:\s*16|9x16|1080\s*[x×]\s*1920/.test(t)) {
    return getFormatPresetById("stories");
  }
  if (/carrossel|carousel|1\s*:\s*1|1x1|quadrado|1080\s*[x×]\s*1080/.test(t)) {
    return getFormatPresetById("post_square");
  }
  if (/feed\s*retrato|4\s*:\s*5|4x5|1080\s*[x×]\s*1350/.test(t)) {
    return getFormatPresetById("feed_portrait");
  }
  if (/16\s*:\s*9|16x9|youtube|paisagem|horizontal\s*larg/.test(t)) {
    return getFormatPresetById("landscape");
  }
  if (/2\s*:\s*3|2x3/.test(t)) return getFormatPresetById("photo_v");
  if (/3\s*:\s*2|3x2/.test(t)) return getFormatPresetById("photo_h");
  if (/4\s*:\s*3|4x3/.test(t)) return getFormatPresetById("classic");
  if (/instagram|insta\b|feed\b/.test(t) && !/stories|reels?/.test(t)) {
    return getFormatPresetById("feed_portrait");
  }
  return getFormatPresetById(DEFAULT_FORMAT_PRESET_ID);
}

/**
 * @param {ArteFormatPreset} preset
 */
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
