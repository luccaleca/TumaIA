/** Edição incremental da prévia gerada. */
const IMAGE_REVISION_INSTRUCTIONS_RE = /^quero\s+alterar\s+a\s+imagem\s*:\s*(.+)$/is;

/** Regerar legenda com instruções do usuário. */
const CAPTION_REVISION_INSTRUCTIONS_RE = /^quero\s+alterar\s+a\s+legenda\s*:\s*(.+)$/is;

const GENERATE_CAPTION_RE = /^gerar\s+legenda\s*[!.?]*$/i;
const GENERATE_IMAGE_RE = /^gerar\s+imagem\s*[!.?]*$/i;
const PUBLISH_INSTAGRAM_RE = /^publicar\s+no\s+instagram\s*[!.?]*$/i;
const ADJUST_CAPTION_PROMPT_RE = /^(?:alterar|mudar)\s+legenda\s*[!.?]*$/i;
const REVISE_IMAGE_PROMPT_RE = /^alterar\s+imagem\s*[!.?]*$/i;
const RESET_SESSION_RE = /^(?:nova\s+conversa|resetar|reiniciar)\s*[!.?]*$/i;

/**
 * @param {string} text
 * @returns {{
 *   type:
 *     | "revise_image"
 *     | "revise_image_prompt"
 *     | "generate_image"
 *     | "generate_caption"
 *     | "regenerate_caption"
 *     | "adjust_caption_prompt"
 *     | "publish_instagram"
 *     | "reset_session";
 *   instructions?: string;
 * } | null}
 */
export function parseTypedDeliveryCommand(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const imageRevision = raw.match(IMAGE_REVISION_INSTRUCTIONS_RE);
  if (imageRevision) {
    const instructions = imageRevision[1].trim();
    return instructions.length >= 3 ? { type: "revise_image", instructions } : null;
  }

  const captionRevision = raw.match(CAPTION_REVISION_INSTRUCTIONS_RE);
  if (captionRevision) {
    const instructions = captionRevision[1].trim();
    return instructions.length >= 3 ? { type: "regenerate_caption", instructions } : null;
  }

  if (GENERATE_IMAGE_RE.test(raw)) return { type: "generate_image" };
  if (GENERATE_CAPTION_RE.test(raw)) return { type: "generate_caption" };
  if (PUBLISH_INSTAGRAM_RE.test(raw)) return { type: "publish_instagram" };
  if (ADJUST_CAPTION_PROMPT_RE.test(raw)) return { type: "adjust_caption_prompt" };
  if (REVISE_IMAGE_PROMPT_RE.test(raw)) return { type: "revise_image_prompt" };
  if (RESET_SESSION_RE.test(raw)) return { type: "reset_session" };

  return null;
}
