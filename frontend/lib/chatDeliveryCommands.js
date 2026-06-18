/** Edição incremental da prévia gerada. */
const IMAGE_REVISION_INSTRUCTIONS_RE = /^quero\s+alterar\s+a\s+imagem\s*:\s*(.+)$/is;

/** Regerar legenda com instruções do usuário. */
const CAPTION_REVISION_INSTRUCTIONS_RE = /^quero\s+alterar\s+a\s+legenda\s*:\s*(.+)$/is;

const GENERATE_CAPTION_RE = /^gerar\s+legenda\s*[!.?]*$/i;
const PUBLISH_INSTAGRAM_RE = /^publicar\s+no\s+instagram\s*[!.?]*$/i;
const ADJUST_CAPTION_PROMPT_RE = /^(?:alterar|mudar)\s+legenda\s*[!.?]*$/i;
const REVISE_IMAGE_PROMPT_RE = /^alterar\s+imagem\s*[!.?]*$/i;

/**
 * @param {string} text
 */
export function isImageRevisionRequest(text) {
  return IMAGE_REVISION_INSTRUCTIONS_RE.test(String(text || "").trim());
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function parseImageRevisionInstructions(text) {
  const raw = String(text || "").trim();
  const m = raw.match(IMAGE_REVISION_INSTRUCTIONS_RE);
  if (!m) return null;
  const instructions = m[1].trim();
  return instructions.length >= 3 ? instructions : null;
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function parseCaptionRevisionInstructions(text) {
  const raw = String(text || "").trim();
  const m = raw.match(CAPTION_REVISION_INSTRUCTIONS_RE);
  if (!m) return null;
  const instructions = m[1].trim();
  return instructions.length >= 3 ? instructions : null;
}

/**
 * Comandos pós-prévia / pós-legenda digitados (atalhos dos botões).
 * @param {string} text
 * @returns {{
 *   type:
 *     | "revise_image"
 *     | "revise_image_prompt"
 *     | "generate_caption"
 *     | "regenerate_caption"
 *     | "adjust_caption_prompt"
 *     | "publish_instagram";
 *   instructions?: string;
 * } | null}
 */
export function parseTypedDeliveryCommand(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const imageRevision = parseImageRevisionInstructions(raw);
  if (imageRevision) return { type: "revise_image", instructions: imageRevision };

  const captionRevision = parseCaptionRevisionInstructions(raw);
  if (captionRevision) return { type: "regenerate_caption", instructions: captionRevision };

  if (GENERATE_CAPTION_RE.test(raw)) return { type: "generate_caption" };
  if (PUBLISH_INSTAGRAM_RE.test(raw)) return { type: "publish_instagram" };
  if (ADJUST_CAPTION_PROMPT_RE.test(raw)) return { type: "adjust_caption_prompt" };
  if (REVISE_IMAGE_PROMPT_RE.test(raw)) return { type: "revise_image_prompt" };

  return null;
}

/**
 * @param {string} text
 */
export function isPostDeliveryTypedCommand(text) {
  return parseTypedDeliveryCommand(text) !== null;
}

/**
 * @param {string} url
 */
export function isHttpFetchableImageUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {string} url
 * @param {string} [origin]
 */
export function resolveImageUrlForRevision(url, origin) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (isHttpFetchableImageUrl(raw)) return raw;
  if (raw.startsWith("/") && origin) {
    const abs = `${origin.replace(/\/$/, "")}${raw}`;
    return isHttpFetchableImageUrl(abs) ? abs : null;
  }
  return null;
}

/**
 * @param {Array<object>} msgs
 */
/**
 * Mensagem da IA com legenda pronta (botões pós-legenda).
 * @param {object | null | undefined} message
 */
export function isCaptionAssistantMessage(message) {
  if (!message || message.role !== "assistant") return false;
  if (Array.isArray(message.image_urls) && message.image_urls.length) return false;
  const actions = message.ui_actions;
  return (
    Array.isArray(actions) &&
    actions.some((a) => a?.id === "publish_instagram" || a?.id === "adjust_caption")
  );
}

export function findLatestCaptionMessageId(msgs) {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role !== "assistant") continue;
    if (Array.isArray(m.image_urls) && m.image_urls.length) continue;
    const actions = m.ui_actions;
    if (
      Array.isArray(actions) &&
      actions.some((a) => a?.id === "publish_instagram" || a?.id === "adjust_caption")
    ) {
      return m.id;
    }
  }
  let seenImage = false;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === "assistant" && Array.isArray(m.image_urls) && m.image_urls.length) {
      seenImage = true;
      continue;
    }
    if (seenImage && m?.role === "assistant" && typeof m.content === "string" && m.content.trim().length > 8) {
      return m.id;
    }
  }
  return null;
}
