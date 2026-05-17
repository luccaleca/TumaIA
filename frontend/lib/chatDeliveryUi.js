/** Espelha `backend/src/services/chatDeliveryUi.js` — pedidos de post / social. */
const DELIVERY_HINT =
  /post(agem|ar|s)?|instagram|insta\b|reels?\b|stories|feed\b|legenda|hashtag|#\w|arte\b|banner|flyer|card[aá]pio|campanha|divulga(c|ç)(a|ã)o|m[ií]dia\s*social|pr[eé][- ]?via|crie\s+(uma?\s+)?(arte|imagem|post)|convite|dia\s+dos|black\s*friday|natal|p[aá]scoa|seguidores?|500\s*k|\bmarco\b|alcance/i;

export function shouldOfferPostContext(question) {
  const q = String(question || "").trim();
  if (q.length < 10) return false;
  return DELIVERY_HINT.test(q);
}
