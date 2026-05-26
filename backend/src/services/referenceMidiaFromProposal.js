import { REFERENCE_MIDIA_MAX } from "./referenceMidiaUrls.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {string[]} ids
 * @param {unknown} id
 */
function pushId(ids, id) {
  const t = String(id ?? "").trim();
  if (!t || !UUID_RE.test(t) || ids.includes(t)) return;
  ids.push(t);
}

/**
 * @param {unknown} links
 * @param {string[]} ids
 */
function pushFromLinks(links, ids) {
  if (!Array.isArray(links)) return;
  for (const l of links) {
    if (!l || typeof l !== "object") continue;
    if (l.kind === "midia") pushId(ids, l.id);
    if (ids.length >= REFERENCE_MIDIA_MAX) return;
  }
}

/**
 * UUIDs de mídia para referência visual (1ª = image_prompt no FLUX Pro).
 * Ordem: midias_referenced → links do supplement → links dentro do proposal.
 *
 * @param {Record<string, unknown> | null | undefined} postContextProposal
 * @param {unknown} [supplementLinks]
 * @returns {string[]}
 */
export function collectReferenceMidiaIds(postContextProposal, supplementLinks) {
  const ids = [];
  if (postContextProposal && typeof postContextProposal === "object") {
    if (
      postContextProposal.hero_product &&
      typeof postContextProposal.hero_product === "object" &&
      typeof postContextProposal.hero_product.id_midia === "string"
    ) {
      pushId(ids, postContextProposal.hero_product.id_midia);
      if (ids.length >= REFERENCE_MIDIA_MAX) return ids.slice(0, REFERENCE_MIDIA_MAX);
    }
    const raw = postContextProposal.midias_referenced;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && typeof item === "object" && typeof item.id_midia === "string") {
          pushId(ids, item.id_midia);
        }
        if (ids.length >= REFERENCE_MIDIA_MAX) return ids.slice(0, REFERENCE_MIDIA_MAX);
      }
    }
    pushFromLinks(postContextProposal.links, ids);
  }
  pushFromLinks(supplementLinks, ids);
  return ids.slice(0, REFERENCE_MIDIA_MAX);
}
