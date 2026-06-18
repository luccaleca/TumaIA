/**
 * Menu `/` no chat — chip ocupa 1 caractere (U+FFFC) no texto; cursor fica depois do chip.
 */

/** Caractere único no textarea; o espelho renderiza como pill `/slug`. */
export const CHAT_CHIP_CHAR = "\uFFFC";

/**
 * @typedef {{ type: "modelo", id: string, nome: string, slug: string } | { type: "midia", id: string, label: string }} SlashChip
 */

/** @returns {SlashChip[]} */
export function emptySlashChips() {
  return [];
}

/**
 * @param {string} text
 */
export function countChatChipChars(text) {
  return (String(text ?? "").match(/\uFFFC/g) || []).length;
}

/**
 * @param {string} text
 * @param {number} pos
 */
export function countChipsBefore(text, pos) {
  let n = 0;
  const limit = Math.min(pos, text.length);
  for (let i = 0; i < limit; i++) {
    if (text[i] === CHAT_CHIP_CHAR) n++;
  }
  return n;
}

/**
 * @param {string} input
 * @param {number} cursorPos
 */
export function parseSlashTrigger(input, cursorPos) {
  const text = String(input ?? "");
  const pos = Number.isFinite(cursorPos) ? cursorPos : text.length;
  if (pos > 0 && text[pos - 1] === CHAT_CHIP_CHAR) return null;
  const before = text.slice(0, pos);
  const match = before.match(/(?:^|\s)\/([^\n/]*)$/);
  if (!match) return null;
  const token = match[0].trimStart();
  const tokenStart = before.length - token.length;
  return {
    query: match[1] ?? "",
    tokenStart,
    tokenEnd: pos,
  };
}

/**
 * @param {string} input
 * @param {{ tokenStart: number, tokenEnd: number }} trigger
 */
export function stripSlashToken(input, trigger) {
  const text = String(input ?? "");
  if (!trigger || trigger.tokenStart < 0) return text;
  const before = text.slice(0, trigger.tokenStart);
  const after = text.slice(trigger.tokenEnd);
  return `${before}${after}`.replace(/\s{2,}/g, " ");
}

export function stripLegacyChatInputMarkers(text) {
  return String(text ?? "").replace(/⟦[^⟧]+⟧/g, "");
}

/**
 * @param {string} slugOrLabel
 */
export function chatTokenDisplayLabel(slugOrLabel) {
  const raw = String(slugOrLabel ?? "").trim();
  if (!raw) return "/item";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/**
 * @param {SlashChip} chip
 */
export function slashChipDisplayLabel(chip) {
  if (!chip) return "/item";
  if (chip.type === "modelo") return chatTokenDisplayLabel(chip.slug || chip.nome);
  return chatTokenDisplayLabel(chip.label);
}

/**
 * @param {SlashChip[]} chips
 * @returns {Array<{ label: string }>}
 */
export function slashChipsToMirrorChips(chips) {
  return (chips || []).map((c) => ({ label: slashChipDisplayLabel(c) }));
}

/**
 * @param {string} text
 * @param {SlashChip[]} chips
 */
export function reconcileSlashChipsWithText(text, chips) {
  const n = countChatChipChars(text);
  const list = Array.isArray(chips) ? chips : [];
  if (n >= list.length) return list;
  return list.slice(0, n);
}

/**
 * @param {SlashChip | { label?: string, slug?: string, nome?: string }} chipOrLabel
 */
export function chipPadLen(chipOrLabel) {
  const label =
    typeof chipOrLabel === "string"
      ? chipOrLabel
      : slashChipDisplayLabel(chipOrLabel);
  return Math.max(0, String(label).length - 1);
}

/**
 * @param {string} text
 * @param {number} chipIndex
 * @param {SlashChip[]} chips
 */
function skipChipPadding(text, chipIndex, chips) {
  const chip = chips[chipIndex];
  const pad = chip ? chipPadLen(chip) : 0;
  let i = 0;
  while (i < pad && text[i] === " ") i++;
  return i;
}

/**
 * @param {string} text
 * @param {SlashChip[]} chips
 */
export function removeModeloChipFromState(text, chips) {
  const list = Array.isArray(chips) ? [...chips] : [];
  const modeloIdx = list.findIndex((c) => c.type === "modelo");
  if (modeloIdx < 0) return { text, chips: list };

  let chipAt = -1;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== CHAT_CHIP_CHAR) continue;
    if (seen === modeloIdx) {
      chipAt = i;
      break;
    }
    seen++;
  }
  if (chipAt < 0) {
    list.splice(modeloIdx, 1);
    return { text, chips: list };
  }

  let nextText = text.slice(0, chipAt) + text.slice(chipAt + 1);
  if (nextText[chipAt] === " ") nextText = nextText.slice(0, chipAt) + nextText.slice(chipAt + 1);
  list.splice(modeloIdx, 1);
  return { text: nextText, chips: list };
}

/**
 * @param {string} text
 * @param {{ tokenStart: number, tokenEnd: number }} trigger
 * @param {string} [chipDisplayLabel]
 * @returns {{ text: string, cursor: number }}
 */
export function insertChipCharAtSlash(text, trigger) {
  const stripped = stripSlashToken(stripLegacyChatInputMarkers(text), trigger);
  const anchor = trigger?.tokenStart >= 0 ? trigger.tokenStart : stripped.length;
  const a = Math.min(Math.max(0, anchor), stripped.length);
  const after = stripped.slice(a);
  const spacer = after.startsWith(" ") ? "" : " ";
  const next = stripped.slice(0, a) + CHAT_CHIP_CHAR + spacer + after;
  return { text: next, cursor: a + 1 + spacer.length };
}

/**
 * @param {string} text
 * @param {SlashChip[]} chips
 */
export function parseSlashInput(text, chips) {
  const raw = String(text ?? "");
  const list = Array.isArray(chips) ? chips : [];
  let chipIdx = 0;
  let plain = "";
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === CHAT_CHIP_CHAR) {
      const chip = list[chipIdx++];
      plain += chip ? ` ${slashChipDisplayLabel(chip)} ` : " ";
    } else {
      plain += raw[i];
    }
  }
  plain = plain.replace(/\s{2,}/g, " ").trim();

  let modelo = null;
  const midias = [];
  for (const c of list) {
    if (c.type === "modelo" && !modelo) {
      modelo = { id: c.id, slug: c.slug, nome: c.nome };
    } else if (c.type === "midia" && !midias.some((m) => m.id === c.id)) {
      midias.push({ id: c.id, label: c.label });
    }
  }

  const displayParts = list.map((c) => slashChipDisplayLabel(c));
  return {
    plainText: plain,
    modelo,
    midias,
    displayFallback: displayParts.join(" ").trim(),
  };
}

/**
 * Texto final para enviar ao chat (inclui labels dos chips + texto digitado).
 * @param {string} text
 * @param {SlashChip[]} chips
 */
export function formatSlashInputForSend(text, chips) {
  const parsed = parseSlashInput(text, chips);
  return parsed.plainText || parsed.displayFallback;
}

/**
 * @param {SlashChip[]} chips
 */
export function slashChipsToApiPicks(chips) {
  const modelo = (chips || []).find((c) => c.type === "modelo");
  return {
    modelo: modelo
      ? { id: modelo.id, nome: modelo.nome || modelo.slug, slug: modelo.slug }
      : null,
    midias: (chips || [])
      .filter((c) => c.type === "midia")
      .map((m) => ({ id: m.id, label: m.label })),
  };
}

/**
 * @param {SlashChip[]} chips
 */
export function listSlashChipMidiaIds(chips) {
  return (chips || []).filter((c) => c.type === "midia").map((c) => c.id);
}

/**
 * @param {string} haystack
 * @param {string} needle
 */
export function slashMenuMatch(haystack, needle) {
  const h = String(haystack ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const n = String(needle ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!n) return true;
  return h.includes(n);
}

export const SLASH_MENU_MAX_MIDIAS = 3;

/** Compat: picks vazios para attachPostContext. */
export function emptySlashPicks() {
  return { modelo: null, midias: [] };
}

export function slashPicksToApiPicks(picks) {
  return picks;
}

export function slashPicksDisplayFallback(picks) {
  const parts = [];
  if (picks?.modelo) parts.push(chatTokenDisplayLabel(picks.modelo.slug || picks.modelo.nome));
  for (const m of picks?.midias || []) parts.push(chatTokenDisplayLabel(m.label));
  return parts.join(" ").trim();
}

export function listSlashPickMidiaIds(picks) {
  return (picks?.midias || []).map((m) => m.id).filter(Boolean);
}
