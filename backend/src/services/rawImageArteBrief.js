import { normalizeHexColor } from "../lib/brandColorScore.js";
import {
  DEFAULT_FORMAT_PRESET_ID,
  detectFormatPresetFromText,
  formatoToJson,
  getFormatPresetById,
  normalizeFormatoFromRaw,
  tryDetectFormatPresetFromText,
} from "./arteFormatPresets.js";
import { deriveFraseNaImagemFromHistory, extractFraseFromUserText, recentUserTexts } from "./imageHeadline.js";
import {
  deriveCreationStateFromHistory,
  extractStyleTermsFromText,
} from "./chatCreationInterpret.js";

const TEMA_MAX = 200;
const TITULO_MAX = 48;
const SUBTITULO_MAX = 72;
const TEXTO_MAX = 140;
const CORES_MAX = 5;

/**
 * @param {string[]} [brandColors]
 */
export function defaultArteBrief(brandColors = []) {
  const preset = getFormatPresetById(DEFAULT_FORMAT_PRESET_ID);
  const cores = [];
  for (const c of brandColors) {
    const hex = normalizeHexColor(c);
    if (hex && !cores.includes(hex) && cores.length < CORES_MAX) cores.push(hex);
  }
  return {
    tema: "",
    formato: formatoToJson(preset),
    cores,
    titulo: "",
    subtitulo: "",
    texto: "",
    rede: "instagram",
    estilo: "",
    observacoes: "",
  };
}

/**
 * @param {unknown} raw
 * @param {string[]} [brandColors]
 */
export function normalizeArteBrief(raw, brandColors = []) {
  const base = defaultArteBrief(brandColors);
  if (!raw || typeof raw !== "object") return base;
  const src = /** @type {Record<string, unknown>} */ (raw);

  const tema = String(src.tema ?? "").trim().slice(0, TEMA_MAX);
  const titulo = String(src.titulo ?? "").trim().slice(0, TITULO_MAX);
  const subtitulo = String(src.subtitulo ?? "").trim().slice(0, SUBTITULO_MAX);
  const texto = String(src.texto ?? "").trim().slice(0, TEXTO_MAX);
  const rede = String(src.rede ?? base.rede).trim().slice(0, 40) || base.rede;
  const estilo = String(src.estilo ?? "").trim().slice(0, 120);
  const observacoes = String(src.observacoes ?? "").trim().slice(0, 300);

  const cores = [];
  const pushCor = (v) => {
    const hex = normalizeHexColor(v);
    if (hex && !cores.includes(hex) && cores.length < CORES_MAX) cores.push(hex);
  };
  if (Array.isArray(src.cores)) {
    for (const c of src.cores) pushCor(c);
  }
  if (!cores.length) base.cores.forEach(pushCor);

  const formato = normalizeFormatoFromRaw(src.formato);

  return {
    tema: tema || base.tema,
    formato: formatoToJson(formato),
    cores,
    titulo,
    subtitulo,
    texto,
    rede,
    estilo,
    observacoes,
  };
}

/**
 * @param {string} text
 */
function detectRede(text) {
  const t = String(text || "").toLowerCase();
  if (/tiktok/.test(t)) return "tiktok";
  if (/linkedin/.test(t)) return "linkedin";
  if (/facebook|meta\b/.test(t)) return "facebook";
  if (/youtube/.test(t)) return "youtube";
  if (/instagram|insta\b|stories|reels?/.test(t)) return "instagram";
  return "";
}

/**
 * @param {string} text
 */
function detectEstilo(text) {
  const t = String(text || "");
  const fromList = extractStyleTermsFromText(t);
  if (fromList.length) return fromList.join(", ").slice(0, 120);
  const m = t.match(
    /(?:estilo|visual|tom)\s*[:\-]?\s*([^.,;]+)|(?:fundo|background)\s+(\w+(?:\s+\w+)?)|(?:gradiente)\s+([^.,;]+)/i,
  );
  if (m) {
    const chunk = (m[1] || m[2] || m[3] || "").trim();
    if (chunk.length >= 3) return chunk.slice(0, 120);
  }
  if (/minimalist|premium|moderno|clean|elegante|photorealistic|realista/i.test(t)) {
    const hit = t.match(
      /photorealistic|fotorealista|minimalist[ao]?|premium|moderno|clean|elegante|realista/i,
    );
    if (hit) return hit[0].slice(0, 120);
  }
  return "";
}

/**
 * Extrai título/subtítulo heurístico de aspas ou linhas em destaque.
 * @param {string} text
 */
function splitTituloSubtitulo(text) {
  const quoted = text.match(/[«"']([^«"']{2,60})[»"']/);
  if (quoted?.[1]) {
    const titulo = quoted[1].trim().slice(0, TITULO_MAX);
    return { titulo, subtitulo: "" };
  }
  const tituloMatch = text.match(/t[ií]tulo\s*:\s*(.+?)(?:\s*[,;]|$)/i);
  if (tituloMatch?.[1]) {
    return {
      titulo: tituloMatch[1].trim().slice(0, TITULO_MAX),
      subtitulo: "",
    };
  }
  const subMatch = text.match(/subt[ií]tulo\s*:\s*(.+?)(?:\s*[,;]|$)/i);
  if (subMatch?.[1]) {
    return { titulo: "", subtitulo: subMatch[1].trim().slice(0, SUBTITULO_MAX) };
  }
  return { titulo: "", subtitulo: "" };
}

/**
 * @param {Array<{ role: string, content: string }>} history
 * @param {string[]} [brandColors]
 * @param {Record<string, unknown>} [existing]
 */
export function buildArteBriefFromHistory(history, brandColors = [], existing = null) {
  const base = normalizeArteBrief(existing, brandColors);
  const userTexts = recentUserTexts(history, 6);
  const userBlob = userTexts.join(" ").trim();
  const latestUser = userTexts.length ? userTexts[userTexts.length - 1] : "";
  const creation = deriveCreationStateFromHistory(history);
  if (!userBlob && !creation.produto) return base;

  // Formato: só a mensagem mais recente pode mudar o preset; senão mantém o atual.
  const explicitFmt = tryDetectFormatPresetFromText(latestUser);
  const preset = explicitFmt
    ? explicitFmt
    : base.formato?.preset_id
      ? getFormatPresetById(base.formato.preset_id)
      : detectFormatPresetFromText(userBlob || creation.tema);
  const { titulo, subtitulo } = splitTituloSubtitulo(userBlob);
  const frase = extractFraseFromUserText(userBlob) || deriveFraseNaImagemFromHistory(history) || "";
  const rede = detectRede(userBlob) || base.rede;
  const estilo =
    creation.estilo ||
    detectEstilo(userBlob) ||
    base.estilo;

  let tema = "";
  if (
    creation.tema ||
    creation.intencao ||
    creation.oferta ||
    creation.produto ||
    creation.sabor ||
    creation.cenario ||
    creation.caracteristica
  ) {
    tema = [
      creation.intencao,
      creation.tema,
      creation.produto,
      creation.sabor ? `sabor ${creation.sabor}` : "",
      creation.oferta,
      creation.cenario ? `cenário ${creation.cenario}` : "",
      creation.caracteristica,
      creation.destaque,
      creation.composicao,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, TEMA_MAX);
  }
  if (!tema) {
    tema = userBlob
      .replace(/frase\s*:\s*.+?(?=\s*[,;]|$)/gi, "")
      .replace(/t[ií]tulo\s*:\s*.+?(?=\s*[,;]|$)/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (tema.length > TEMA_MAX) tema = `${tema.slice(0, TEMA_MAX - 1)}…`;

  const texto =
    (frase && frase !== titulo ? frase.slice(0, TEXTO_MAX) : "") ||
    (creation.oferta ? String(creation.oferta).slice(0, TEXTO_MAX) : "") ||
    base.texto;
  const observacoes = [creation.destaque, creation.composicao, creation.caracteristica, base.observacoes]
    .filter(Boolean)
    .join(". ")
    .slice(0, 300);

  return normalizeArteBrief(
    {
      tema: tema || base.tema,
      formato: formatoToJson(preset),
      cores: base.cores.length ? base.cores : undefined,
      titulo: titulo || base.titulo,
      subtitulo: subtitulo || base.subtitulo,
      texto: texto || base.texto,
      rede,
      estilo,
      observacoes: observacoes || base.observacoes,
    },
    brandColors,
  );
}

/**
 * Mescla extração do histórico sem apagar campos que o usuário já editou no painel.
 * Formato: se o chat pediu ratio/preset explícito, a extração prevalece.
 *
 * @param {Record<string, unknown>} draft
 * @param {Record<string, unknown>} extracted
 * @param {{ preferExtractedFormato?: boolean }} [opts]
 */
export function mergeArteBriefUserEdits(draft, extracted, opts = {}) {
  const d = normalizeArteBrief(draft);
  const e = normalizeArteBrief(extracted, d.cores);
  const preferFmt = Boolean(opts.preferExtractedFormato);
  return normalizeArteBrief({
    tema: d.tema.trim() ? d.tema : e.tema,
    formato: preferFmt && e.formato?.preset_id ? e.formato : d.formato?.preset_id ? d.formato : e.formato,
    cores: d.cores.length ? d.cores : e.cores,
    titulo: d.titulo.trim() ? d.titulo : e.titulo,
    subtitulo: d.subtitulo.trim() ? d.subtitulo : e.subtitulo,
    texto: d.texto.trim() ? d.texto : e.texto,
    rede: d.rede && d.rede !== "instagram" ? d.rede : e.rede || d.rede,
    // Estilo/destaque: instrução recente do chat prevalece sobre rascunho antigo.
    estilo: e.estilo.trim() ? e.estilo : d.estilo,
    observacoes: e.observacoes.trim() ? e.observacoes : d.observacoes,
  });
}

/**
 * @param {Record<string, unknown>} arteBrief
 */
export function promptFromArteBrief(arteBrief) {
  const b = normalizeArteBrief(arteBrief);
  const parts = [];
  if (b.tema) parts.push(`Tema: ${b.tema}`);
  const f = b.formato;
  if (f?.ratio) {
    const label = [f.label, f.subtitle].filter(Boolean).join(" · ");
    parts.push(`Formato: ${label} (${f.ratio}${f.pixels && f.pixels !== "—" ? `, ${f.pixels}` : ""})`);
  }
  if (b.cores.length) parts.push(`Cores da arte: ${b.cores.join(", ")}`);
  if (b.titulo) parts.push(`Título na imagem: «${b.titulo}»`);
  if (b.subtitulo) parts.push(`Subtítulo na imagem: «${b.subtitulo}»`);
  if (b.texto) parts.push(`Texto na imagem: «${b.texto}»`);
  if (b.estilo) parts.push(`Estilo visual: ${b.estilo}`);
  if (b.rede) parts.push(`Rede: ${b.rede}`);
  if (b.observacoes) parts.push(`Observações: ${b.observacoes}`);
  if (!parts.length) return "";
  return `Imagem para rede social.\n${parts.join("\n")}`;
}

/**
 * @param {Record<string, unknown>} arteBrief
 * @returns {string | null}
 */
/** API Replicate GPT Image 2 não aceita 4:5 nem 4:3 — aproximação. */
const RATIO_TO_API = {
  "4:5": "2:3",
  "4:3": "3:2",
};

export function aspectRatioFromArteBrief(arteBrief) {
  const ratio = String(arteBrief?.formato?.ratio ?? "").trim();
  const mapped = RATIO_TO_API[ratio] || ratio;
  const allowed = new Set(["1:1", "16:9", "9:16", "3:2", "2:3"]);
  if (allowed.has(mapped)) return mapped;
  return null;
}
