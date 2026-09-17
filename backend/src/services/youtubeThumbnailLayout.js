/**
 * Layout de thumbnail YouTube estilo curiosidade: título amarelo + seta grossa
 * apontando para o detalhe — texto e seta formam um único elemento gráfico.
 */

const YOUTUBE_POINTER_RE =
  /(?:youtube|thumbnail|thumb\b|capa\s+(?:do\s+)?v[ií]deo|miniatura\s+(?:do\s+)?v[ií]deo)/i;

const POINTER_RE =
  /(?:seta|arrow|aponta(?:ndo|r)?|\bpointer\b|c[ií]rculo\s+vermelho|circulo\s+vermelho)/i;

const LAYOUT_HINT_RE =
  /(?:ter[cç]o\s+superior|topo\s+da\s+(?:imagem|arte|thumb)|t[ií]tulo\s+amarelo|texto\s+amarelo|headline|curiosidade)/i;

/**
 * @param {string} text
 */
export function looksLikeYoutubePointerThumbnail(text) {
  const t = String(text || "").trim();
  if (!t) return false;

  const hasPlatform = YOUTUBE_POINTER_RE.test(t);
  const hasPointer = POINTER_RE.test(t);
  const hasLayoutHint = LAYOUT_HINT_RE.test(t);

  if (hasPlatform && hasPointer) return true;
  if (hasPointer && hasLayoutHint) return true;
  if (/thumbnail\s+youtube|youtube\s+thumbnail|capa\s+youtube/i.test(t)) return true;
  if (hasPlatform && /curiosidade/i.test(t)) return true;

  return false;
}

/**
 * @param {{ fraseNaImagem?: string | null, pedido?: string | null }} [ctx]
 */
export function youtubePointerThumbnailPromptBlock(ctx = {}) {
  const frase = String(ctx.fraseNaImagem || "").trim();
  const pedido = String(ctx.pedido || "").trim();

  const lines = [
    "LAYOUT THUMBNAIL YOUTUBE (obrigatório):",
    "- Título no topo: sans-serif bold, ALL CAPS, amarelo vibrante (#FFD700) com contorno preto grosso; ocupa o terço superior (~5–14% da altura), centralizado, legível em miniatura.",
    "- Seta grossa (vermelha ou amarela): a CAUDA da seta encosta na base do título — zero espaço vazio entre texto e seta; formam um único bloco gráfico contínuo.",
    "- A ponta da seta aponta para o detalhe/subject no centro ou terço inferior (produto, rosto, objeto, rótulo).",
    "- PROIBIDO: título flutuando separado da seta; gap entre texto e seta; seta começando no meio da imagem sem ligar ao título.",
  ];

  if (frase) {
    lines.push(`- Texto exato do título: «${frase}».`);
  } else if (pedido) {
    lines.push("- Use a pergunta/frase-chave do pedido como título exato, com ortografia correta.");
  }

  return lines.join("\n");
}
