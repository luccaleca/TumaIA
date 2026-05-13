/**
 * Heurística: pedidos editoriais / social costumam beneficiar do par
 * “texto primeiro” vs “imagem primeiro” (botões no chat).
 */
const DELIVERY_HINT =
  /post(agem|ar|s)?|instagram|insta\b|reels?\b|stories|feed\b|legenda|hashtag|#\w|arte\b|banner|flyer|card[aá]pio|campanha|divulga(c|ç)(a|ã)o|m[ií]dia\s*social|pr[eé][- ]?via|crie\s+(uma?\s+)?(arte|imagem|post)|convite|dia\s+dos|black\s*friday|natal|p[aá]scoa/i;

export function shouldOfferDeliveryButtons(question) {
  const q = String(question || "").trim();
  if (q.length < 10) return false;
  return DELIVERY_HINT.test(q);
}

export const DELIVERY_UI_ACTIONS = [
  { id: "text_first", label: "Gerar legenda e hashtags primeiro" },
  { id: "image_first", label: "Gerar prévia da imagem primeiro" },
];
