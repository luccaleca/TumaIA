/**
 * Heurística: pedidos editoriais / social — o backend pode anexar `post_supplement`
 * (confirmação + links reais para contexto/mídia) na mesma resposta do chat.
 */
const DELIVERY_HINT =
  /post(agem|ar|s)?|instagram|insta\b|reels?\b|stories|feed\b|legenda|hashtag|#\w|arte\b|banner|flyer|card[aá]pio|campanha|divulga(c|ç)(a|ã)o|m[ií]dia\s*social|pr[eé][- ]?via|cri(e|ar)\s+(uma?\s+)?(arte|imagem|post)|mont(a|ar)\s+(a\s+)?(arte|imagem|post)|montar|gerar\s+imagem|imagem\s+para|fazer\s+(um\s+)?post|convite|dia\s+dos|black\s*friday|natal|p[aá]scoa|seguidores?|500\s*k|\bmarco\b|alcance|whey|suplement/i;

export function shouldOfferDeliveryButtons(question) {
  const q = String(question || "").trim();
  if (q.length < 10) return false;
  return DELIVERY_HINT.test(q);
}
